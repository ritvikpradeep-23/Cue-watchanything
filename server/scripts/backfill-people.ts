/**
 * Steps 3-6 of the actor/director finder spec's backfill migration:
 *   3. Create an Actor row for every unique name across every title's `cast`, link via
 *      TitleActor.
 *   4. Create a Director row for every unique name across every title's `directors` (populated
 *      by resolve-director-credits.ts — run that first), link via TitleDirector.
 *   5. Compute known_for_styles for every director once links are in place.
 *   6. Report counts.
 *
 * Idempotent AND batched — an earlier version of this script did one row/link at a time (up to
 * ~13,000 individual round trips for ~5000 actors), which was both slow enough to look hung and
 * prone to exhausting Neon's pooled-connection limit. This version does one bulk read of what
 * already exists, computes the diff in memory, and writes only what's missing in large
 * createMany batches.
 *
 * Run with: npx tsx scripts/backfill-people.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { recomputeKnownForStyles } from "../src/lib/directors";

const WRITE_BATCH = 500;

async function batchCreateMany<T>(rows: T[], fn: (batch: T[]) => Promise<{ count: number }>): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += WRITE_BATCH) {
    const batch = rows.slice(i, i + WRITE_BATCH);
    const result = await fn(batch);
    total += result.count;
  }
  return total;
}

async function main() {
  const titles = await prisma.title.findMany({
    select: { id: true, cast: true, directors: true, tags: true },
  });
  console.log(`Loaded ${titles.length} titles.`);

  function industryOf(tagsJson: string): string[] {
    try {
      return JSON.parse(tagsJson)?.industry ?? [];
    } catch {
      return [];
    }
  }

  // ---- actors ----
  const actorTitles = new Map<string, { titleIds: Set<string>; industries: Set<string> }>();
  for (const t of titles) {
    const cast: string[] = JSON.parse(t.cast || "[]");
    const industries = industryOf(t.tags);
    for (const name of cast) {
      if (!name?.trim()) continue;
      const entry = actorTitles.get(name) ?? { titleIds: new Set(), industries: new Set() };
      entry.titleIds.add(t.id);
      for (const ind of industries) entry.industries.add(ind);
      actorTitles.set(name, entry);
    }
  }
  console.log(`Found ${actorTitles.size} unique actor names across the catalog.`);

  const existingActors = await prisma.actor.findMany({ select: { id: true, name: true } });
  const actorIdByName = new Map(existingActors.map((a) => [a.name, a.id]));

  const actorsToCreate = [...actorTitles.entries()]
    .filter(([name]) => !actorIdByName.has(name))
    .map(([name, { industries }]) => ({ name, industry: JSON.stringify([...industries]) }));
  if (actorsToCreate.length > 0) {
    await batchCreateMany(actorsToCreate, (batch) => prisma.actor.createMany({ data: batch, skipDuplicates: true }));
    // re-fetch to get ids for the rows we just created
    const refreshed = await prisma.actor.findMany({ select: { id: true, name: true } });
    for (const a of refreshed) actorIdByName.set(a.name, a.id);
  }
  console.log(`Created ${actorsToCreate.length} new actor rows (${existingActors.length} already existed).`);

  const existingActorLinks = new Set(
    (await prisma.titleActor.findMany({ select: { titleId: true, actorId: true } })).map(
      (l) => `${l.titleId}:${l.actorId}`,
    ),
  );
  const actorLinksToCreate: { titleId: string; actorId: string }[] = [];
  for (const [name, { titleIds }] of actorTitles) {
    const actorId = actorIdByName.get(name)!;
    for (const titleId of titleIds) {
      if (!existingActorLinks.has(`${titleId}:${actorId}`)) actorLinksToCreate.push({ titleId, actorId });
    }
  }
  const actorLinksCreated = await batchCreateMany(actorLinksToCreate, (batch) =>
    prisma.titleActor.createMany({ data: batch, skipDuplicates: true }),
  );
  console.log(`Created ${actorLinksCreated} new title-actor links.`);

  // ---- directors ----
  const directorTitles = new Map<string, { titleIds: Set<string>; industries: Set<string> }>();
  for (const t of titles) {
    const directors: string[] = JSON.parse(t.directors || "[]");
    const industries = industryOf(t.tags);
    for (const name of directors) {
      if (!name?.trim()) continue;
      const entry = directorTitles.get(name) ?? { titleIds: new Set(), industries: new Set() };
      entry.titleIds.add(t.id);
      for (const ind of industries) entry.industries.add(ind);
      directorTitles.set(name, entry);
    }
  }
  console.log(`Found ${directorTitles.size} unique director names (from resolved credits).`);

  const existingDirectors = await prisma.director.findMany({ select: { id: true, name: true } });
  const directorIdByName = new Map(existingDirectors.map((d) => [d.name, d.id]));

  const directorsToCreate = [...directorTitles.entries()]
    .filter(([name]) => !directorIdByName.has(name))
    .map(([name, { industries }]) => ({ name, industry: JSON.stringify([...industries]) }));
  if (directorsToCreate.length > 0) {
    await batchCreateMany(directorsToCreate, (batch) => prisma.director.createMany({ data: batch, skipDuplicates: true }));
    const refreshed = await prisma.director.findMany({ select: { id: true, name: true } });
    for (const d of refreshed) directorIdByName.set(d.name, d.id);
  }
  console.log(`Created ${directorsToCreate.length} new director rows (${existingDirectors.length} already existed).`);

  const existingDirectorLinks = new Set(
    (await prisma.titleDirector.findMany({ select: { titleId: true, directorId: true } })).map(
      (l) => `${l.titleId}:${l.directorId}`,
    ),
  );
  const directorLinksToCreate: { titleId: string; directorId: string }[] = [];
  const directorsToRecompute = new Set<string>();
  for (const [name, { titleIds }] of directorTitles) {
    const directorId = directorIdByName.get(name)!;
    for (const titleId of titleIds) {
      if (!existingDirectorLinks.has(`${titleId}:${directorId}`)) {
        directorLinksToCreate.push({ titleId, directorId });
        directorsToRecompute.add(directorId);
      }
    }
  }
  const directorLinksCreated = await batchCreateMany(directorLinksToCreate, (batch) =>
    prisma.titleDirector.createMany({ data: batch, skipDuplicates: true }),
  );
  console.log(`Created ${directorLinksCreated} new title-director links.`);

  const directorsMissingStyles = await prisma.director.findMany({
    where: { knownForStyles: "[]" },
    select: { id: true },
  });
  for (const d of directorsMissingStyles) directorsToRecompute.add(d.id);

  console.log(`Computing known_for_styles for ${directorsToRecompute.size} directors...`);
  const recomputeIds = [...directorsToRecompute];
  // Sequential, not chunked-concurrent — this step kept hitting transient Neon pool errors at
  // even modest concurrency right after a run of heavy batched writes. Cheap per-director, so
  // sequential is still fast enough at this data size (~1500 directors).
  let recomputed = 0;
  for (const id of recomputeIds) {
    await recomputeKnownForStyles(id);
    recomputed++;
    if (recomputed % 200 === 0) console.log(`  recomputed ${recomputed}/${recomputeIds.length}...`);
  }

  // ---- report ----
  const titlesWithNoDirector = titles.filter((t) => JSON.parse(t.directors || "[]").length === 0).length;
  console.log("\n=== BACKFILL SUMMARY ===");
  console.log(`Actors: ${actorTitles.size} total (${actorsToCreate.length} new), ${actorLinksCreated} new links`);
  console.log(`Directors: ${directorTitles.size} total (${directorsToCreate.length} new), ${directorLinksCreated} new links`);
  console.log(`Titles with no resolved director: ${titlesWithNoDirector}/${titles.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
