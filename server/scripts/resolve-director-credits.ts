/**
 * Resolves director credit(s) for every title in the DB via TMDB (search + credits.crew,
 * job === "Director"), writes results to director-credits.json, then updates each Title's
 * `directors` field in the DB. Step 1-2 of the actor/director finder spec's backfill.
 *
 * Incremental/resumable, same convention as fetch-posters.ts: a title already marked
 * `resolved: true` in the cache file is skipped on rerun.
 *
 * Run with: npx tsx scripts/resolve-director-credits.ts
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";
import { DIRECTOR_CREDITS_FILE, loadDirectorCredits, type DirectorCreditsResult } from "./lib/directorCredits";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url);
    } catch {
      if (attempt === attempts) return null;
      await sleep(500 * attempt);
    }
  }
  return null;
}

async function resolveDirectors(name: string, tmdbType: "movie" | "tv", year: number): Promise<string[] | null> {
  const yearParam = tmdbType === "movie" ? `&year=${year}` : `&first_air_date_year=${year}`;
  const searchUrl = `${BASE}/search/${tmdbType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}${yearParam}&include_adult=false`;
  const searchRes = await fetchWithRetry(searchUrl);
  if (!searchRes || !searchRes.ok) return null;
  const searchData = await searchRes.json().catch(() => null);
  const hit = searchData?.results?.[0];
  if (!hit?.id) return null;

  const detailUrl = `${BASE}/${tmdbType}/${hit.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  const detailRes = await fetchWithRetry(detailUrl);
  if (!detailRes || !detailRes.ok) return null;
  const detail = await detailRes.json().catch(() => null);
  if (!detail) return null;

  const crew: any[] = detail.credits?.crew ?? [];
  const directors = crew.filter((c) => c.job === "Director").map((c) => c.name).filter(Boolean);
  return directors.slice(0, 2); // cap at 2 — co-directed titles exist but rarely more than that
}

async function main() {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY not set in server/.env — cannot resolve director credits.");
    process.exit(1);
  }

  const titles = await prisma.title.findMany({
    select: { id: true, name: true, type: true, releaseYear: true, seasons: true, episodes: true },
  });
  console.log(`Resolving director credits for ${titles.length} titles...`);

  const results: Record<string, DirectorCreditsResult> = loadDirectorCredits();
  let resolved = 0;
  let empty = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, title] of titles.entries()) {
    const existing = results[title.id];
    if (existing?.resolved) {
      skipped++;
      continue;
    }

    const isSeries = title.seasons != null || title.episodes != null || title.type === "show";
    const tmdbType: "movie" | "tv" = title.type === "movie" || (title.type === "anime" && !isSeries) ? "movie" : "tv";

    try {
      const directors = await resolveDirectors(title.name, tmdbType, title.releaseYear);
      await sleep(400);
      if (directors === null) {
        results[title.id] = { directors: [], resolved: false };
        failed++;
        console.log(`[${i + 1}/${titles.length}] ${title.name} -> lookup failed`);
      } else {
        results[title.id] = { directors, resolved: true };
        if (directors.length > 0) resolved++;
        else empty++;
        console.log(`[${i + 1}/${titles.length}] ${title.name} -> ${directors.length > 0 ? directors.join(", ") : "(no director credit)"}`);
      }
    } catch (e: any) {
      results[title.id] = { directors: [], resolved: false };
      failed++;
      console.error(`[${i + 1}/${titles.length}] ${title.name} -> ERROR: ${e.message}`);
    }

    if ((i + 1) % 50 === 0) writeFileSync(DIRECTOR_CREDITS_FILE, JSON.stringify(results, null, 2), "utf-8");
  }

  writeFileSync(DIRECTOR_CREDITS_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nResolved with director(s): ${resolved}, resolved with none: ${empty}, failed/unresolved: ${failed}, skipped (already done): ${skipped}`);

  // Apply to DB — separate from resolution above so a rerun of just this step (e.g. after
  // manually editing the cache file) doesn't re-hit the network.
  console.log("\nApplying resolved directors to the DB...");
  let updated = 0;
  for (const [i, title] of titles.entries()) {
    const entry = results[title.id];
    if (!entry?.resolved || entry.directors.length === 0) continue;
    await prisma.title.update({ where: { id: title.id }, data: { directors: JSON.stringify(entry.directors) } });
    updated++;
    if ((i + 1) % 200 === 0) console.log(`  applied ${updated} so far...`);
  }
  console.log(`Applied directors to ${updated} titles.`);

  if (failed > 0) {
    console.log(`\n${failed} title(s) still need director resolution — run this script again to retry (transient errors are retried automatically).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
