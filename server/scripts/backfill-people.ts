/**
 * Steps 3-6 of the actor/director finder spec's backfill migration:
 *   3. Create an Actor row for every unique name across every title's `cast`, link via
 *      TitleActor.
 *   4. Create a Director row for every unique name across every title's `directors` (populated
 *      by resolve-director-credits.ts — run that first), link via TitleDirector.
 *   5. Compute known_for_styles for every director once links are in place.
 *   6. Report counts.
 *
 * Idempotent: an existing Actor/Director with the same name is reused (by exact-name lookup
 * built once at the start), never duplicated, and TitleActor/TitleDirector links use
 * upsert-by-unique-constraint so rerunning is always safe.
 *
 * Run with: npx tsx scripts/backfill-people.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { recomputeKnownForStyles } from "../src/lib/directors";

// Lower than seed-batches.ts's CHUNK_SIZE=8 — this script's write volume (thousands of unique
// actor names, each its own create + N title links) exhausted the pool at 8-way concurrency.
const CHUNK_SIZE = 3;

async function chunked<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
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

  let actorsCreated = 0;
  const actorNames = [...actorTitles.keys()];
  await chunked(actorNames, CHUNK_SIZE, async (name) => {
    if (actorIdByName.has(name)) return;
    const { industries } = actorTitles.get(name)!;
    const actor = await prisma.actor.create({
      data: { name, industry: JSON.stringify([...industries]) },
    });
    actorIdByName.set(name, actor.id);
    actorsCreated++;
  });
  console.log(`Created ${actorsCreated} new actor rows (${existingActors.length} already existed).`);

  let actorLinksCreated = 0;
  for (const [name, { titleIds }] of actorTitles) {
    const actorId = actorIdByName.get(name)!;
    await chunked([...titleIds], CHUNK_SIZE, async (titleId) => {
      const result = await prisma.titleActor
        .createMany({ data: [{ titleId, actorId }], skipDuplicates: true })
        .catch(() => null);
      if (result && result.count > 0) actorLinksCreated++;
    });
  }
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

  let directorsCreated = 0;
  const directorNames = [...directorTitles.keys()];
  await chunked(directorNames, CHUNK_SIZE, async (name) => {
    if (directorIdByName.has(name)) return;
    const { industries } = directorTitles.get(name)!;
    const director = await prisma.director.create({
      data: { name, industry: JSON.stringify([...industries]) },
    });
    directorIdByName.set(name, director.id);
    directorsCreated++;
  });
  console.log(`Created ${directorsCreated} new director rows (${existingDirectors.length} already existed).`);

  let directorLinksCreated = 0;
  const directorsToRecompute = new Set<string>();
  for (const [name, { titleIds }] of directorTitles) {
    const directorId = directorIdByName.get(name)!;
    await chunked([...titleIds], CHUNK_SIZE, async (titleId) => {
      const result = await prisma.titleDirector
        .createMany({ data: [{ titleId, directorId }], skipDuplicates: true })
        .catch(() => null);
      if (result && result.count > 0) {
        directorLinksCreated++;
        directorsToRecompute.add(directorId);
      }
    });
  }
  console.log(`Created ${directorLinksCreated} new title-director links.`);

  // known_for_styles for every director that got a new link this run, plus any director with
  // no styles computed yet at all (covers a fresh/first run).
  const directorsMissingStyles = await prisma.director.findMany({
    where: { knownForStyles: "[]" },
    select: { id: true },
  });
  for (const d of directorsMissingStyles) directorsToRecompute.add(d.id);

  console.log(`Computing known_for_styles for ${directorsToRecompute.size} directors...`);
  await chunked([...directorsToRecompute], CHUNK_SIZE, (id) => recomputeKnownForStyles(id));

  // ---- report ----
  const titlesWithNoDirector = titles.filter((t) => JSON.parse(t.directors || "[]").length === 0).length;
  console.log("\n=== BACKFILL SUMMARY ===");
  console.log(`Actors: ${actorTitles.size} total (${actorsCreated} new), ${actorLinksCreated} new links`);
  console.log(`Directors: ${directorTitles.size} total (${directorsCreated} new), ${directorLinksCreated} new links`);
  console.log(`Titles with no resolved director: ${titlesWithNoDirector}/${titles.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
