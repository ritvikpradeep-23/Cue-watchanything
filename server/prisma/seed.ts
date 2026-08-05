import { existsSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { TITLES } from "./seed-data/titles";

const prisma = new PrismaClient();

// Optional enrichment step: server/scripts/fetch-posters.ts resolves real poster art
// (Wikipedia, falling back to TMDB) into this file. When present, its resolved URL wins;
// titles it couldn't resolve (or if the file doesn't exist at all, e.g. it hasn't been run yet)
// keep the generated placeholder SVG from seed-data/titles.ts.
const POSTER_URLS_FILE = path.resolve(__dirname, "../scripts/poster-urls.json");

function loadResolvedPosterUrls(): Record<string, string> {
  if (!existsSync(POSTER_URLS_FILE)) return {};
  const raw = JSON.parse(readFileSync(POSTER_URLS_FILE, "utf-8")) as Record<
    string,
    { posterUrl: string | null }
  >;
  const resolved: Record<string, string> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (entry.posterUrl) resolved[id] = entry.posterUrl;
  }
  return resolved;
}

async function main() {
  const resolvedPosterUrls = loadResolvedPosterUrls();
  const resolvedCount = Object.keys(resolvedPosterUrls).length;
  console.log(
    `Seeding ${TITLES.length} titles` +
      (resolvedCount > 0
        ? ` (${resolvedCount} with real poster art from poster-urls.json, rest use the generated placeholder)...`
        : " (no poster-urls.json found — all titles use the generated placeholder poster)..."),
  );

  await prisma.$transaction(
    TITLES.map((t) => {
      const posterUrl = resolvedPosterUrls[t.id] ?? t.poster_url;
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
          posterUrl,
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
          posterUrl,
          tags: JSON.stringify(t.tags),
        },
      });
    }),
  );

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
