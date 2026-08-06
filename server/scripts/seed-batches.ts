/**
 * Upserts every title registered in prisma/seed-data/batches/index.ts into the DB — the
 * growable-dataset counterpart to prisma/seed.ts, which only ever touches the original core
 * seed. Keeping them separate means adding a new batch never has to re-touch or re-run against
 * titles.ts, consistent with "DB is the runtime source of truth" (see routes/admin.ts).
 *
 * Same non-destructive posterUrl rule as seed.ts: update only overwrites posterUrl when
 * poster-urls.json actually has a freshly resolved one for that title, so an environment
 * without that (gitignored) file present can never regress a poster already stored in the DB.
 *
 * Deliberately NOT wrapped in a single prisma.$transaction([...]) — with 500+ independent,
 * idempotent upserts that stopped being viable (Neon's pooled connection was closing mid-way
 * through the transaction, P1017). Each upsert commits on its own in small concurrent chunks
 * instead; a mid-run failure just means re-running picks up where it left off.
 */
import { PrismaClient } from "@prisma/client";
import { BATCH_TITLES } from "../prisma/seed-data/batches";
import { loadResolvedPosterUrls } from "./lib/posterUrls";

const prisma = new PrismaClient();
const CHUNK_SIZE = 8; // Neon's pooled connection limit here is 13 — stay well under it

async function main() {
  const resolvedPosterUrls = loadResolvedPosterUrls();
  const resolvedCount = BATCH_TITLES.filter((t) => resolvedPosterUrls[t.id]).length;
  console.log(
    `Seeding ${BATCH_TITLES.length} batch titles (${resolvedCount} with real poster art, rest use the generated placeholder)...`,
  );

  for (let i = 0; i < BATCH_TITLES.length; i += CHUNK_SIZE) {
    const chunk = BATCH_TITLES.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((t) => {
        const resolvedPosterUrl = resolvedPosterUrls[t.id];
        return prisma.title.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            name: t.name,
            type: t.type,
            plotSummary: t.plot_summary,
            cast: JSON.stringify(t.cast),
            seasons: t.seasons,
            episodes: t.episodes,
            runtimeMinutes: t.runtime_minutes,
            releaseYear: t.release_year,
            platforms: JSON.stringify(t.platforms),
            languages: JSON.stringify(t.languages),
            posterUrl: resolvedPosterUrl ?? t.poster_url,
            tags: JSON.stringify(t.tags),
          },
          update: {
            name: t.name,
            type: t.type,
            plotSummary: t.plot_summary,
            cast: JSON.stringify(t.cast),
            seasons: t.seasons,
            episodes: t.episodes,
            runtimeMinutes: t.runtime_minutes,
            releaseYear: t.release_year,
            platforms: JSON.stringify(t.platforms),
            languages: JSON.stringify(t.languages),
            ...(resolvedPosterUrl ? { posterUrl: resolvedPosterUrl } : {}),
            tags: JSON.stringify(t.tags),
          },
        });
      }),
    );
    console.log(`  ${Math.min(i + CHUNK_SIZE, BATCH_TITLES.length)}/${BATCH_TITLES.length}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
