import { PrismaClient } from "@prisma/client";
import { TITLES } from "./seed-data/titles";
import { loadResolvedPosterUrls } from "../scripts/lib/posterUrls";

const prisma = new PrismaClient();

async function main() {
  const resolvedPosterUrls = loadResolvedPosterUrls();
  const resolvedCount = Object.keys(resolvedPosterUrls).length;
  console.log(
    `Seeding ${TITLES.length} titles` +
      (resolvedCount > 0
        ? ` (${resolvedCount} with real poster art from poster-urls.json, rest use the generated placeholder)...`
        : " (no poster-urls.json found — all titles use the generated placeholder poster)..."),
  );

  // Not wrapped in prisma.$transaction([...]) — see seed-batches.ts for why (Neon closing
  // pooled connections mid-transaction on large upsert sets, P1017). Each upsert commits on its
  // own in small concurrent chunks instead.
  const CHUNK_SIZE = 8; // Neon's pooled connection limit here is 13 — stay well under it
  for (let i = 0; i < TITLES.length; i += CHUNK_SIZE) {
    const chunk = TITLES.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((t) => {
        // poster-urls.json is gitignored (local/CI artifact, not committed) so it won't exist in
        // environments that only have the git-tracked source, e.g. Vercel's build. In that case
        // resolvedPosterUrls is empty — update must NOT fall back to the placeholder there, or
        // every deploy would clobber real poster art already resolved and stored on a prior run
        // with a live resolution file. Only overwrite posterUrl on update when we actually have a
        // freshly resolved one; otherwise leave whatever's already in the DB alone. create has no
        // prior value to preserve, so it still falls back to the placeholder as before.
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
