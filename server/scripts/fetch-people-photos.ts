/**
 * Sources a photo for every Actor/Director row, same fallback order as fetch-posters.ts:
 *   1. Wikipedia/Wikimedia page image (no API key needed).
 *   2. TMDB /search/person, profile_path (only reached when Wikipedia has nothing).
 *   3. Neither found -> photoUrl stays null; the frontend shows a generic placeholder avatar,
 *      and this run's unresolved names are written to needs-manual-photo.json so the gap is
 *      visible instead of silently blank.
 *
 * Incremental: skips anyone already resolved in photo-urls.json on rerun.
 *
 * Run with: npx tsx scripts/fetch-people-photos.ts
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

const PHOTO_URLS_FILE = path.resolve(__dirname, "photo-urls.json");
const NEEDS_MANUAL_FILE = path.resolve(__dirname, "needs-manual-photo.json");
const USER_AGENT = "Cue-PhotoFetch/1.0 (educational demo project; contact: n/a)";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

type PhotoResult = { photoUrl: string | null; source: "wikipedia" | "tmdb" | null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 4): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch {
      if (attempt === attempts) return null;
      await sleep(500 * attempt);
    }
  }
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isPlausibleMatch(name: string, articleTitle: string): boolean {
  return normalize(articleTitle).includes(normalize(name));
}

async function searchArticleTitle(name: string, hint: string): Promise<string | null> {
  const query = hint ? `${name} ${hint}` : name;
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`;
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    return data?.query?.search?.[0]?.title ?? null;
  } catch {
    return null;
  }
}

async function fetchPageImage(articleTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&prop=pageimages&format=json&pithumbsize=500&pilicense=free&redirects=1`;
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function fetchTmdbPersonPhoto(name: string): Promise<string | null> {
  if (!TMDB_API_KEY) return null;
  const url = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&include_adult=false`;
  const res = await fetchWithRetry(url);
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    const profilePath = data?.results?.[0]?.profile_path;
    return profilePath ? `${TMDB_IMAGE_BASE}${profilePath}` : null;
  } catch {
    return null;
  }
}

async function main() {
  const [actors, directors] = await Promise.all([
    prisma.actor.findMany({ select: { id: true, name: true } }),
    prisma.director.findMany({ select: { id: true, name: true } }),
  ]);
  const people = [
    ...actors.map((a) => ({ ...a, kind: "actor" as const })),
    ...directors.map((d) => ({ ...d, kind: "director" as const })),
  ];
  console.log(`Resolving photos for ${people.length} people (${actors.length} actors, ${directors.length} directors)...`);

  const results: Record<string, PhotoResult> = existsSync(PHOTO_URLS_FILE)
    ? JSON.parse(readFileSync(PHOTO_URLS_FILE, "utf-8"))
    : {};

  let foundWikipedia = 0;
  let foundTmdb = 0;
  let missing = 0;
  let skipped = 0;

  for (const [i, person] of people.entries()) {
    const key = `${person.kind}:${person.id}`;
    if (results[key]?.photoUrl) {
      skipped++;
      continue;
    }

    try {
      let articleTitle = await searchArticleTitle(person.name, "actor");
      if (articleTitle && !isPlausibleMatch(person.name, articleTitle)) articleTitle = null;
      let photoUrl: string | null = articleTitle ? await fetchPageImage(articleTitle) : null;

      if (photoUrl) {
        results[key] = { photoUrl, source: "wikipedia" };
        foundWikipedia++;
      } else {
        const tmdbUrl = await fetchTmdbPersonPhoto(person.name);
        if (tmdbUrl) {
          results[key] = { photoUrl: tmdbUrl, source: "tmdb" };
          foundTmdb++;
        } else {
          results[key] = { photoUrl: null, source: null };
          missing++;
        }
      }
      console.log(`[${i + 1}/${people.length}] ${person.name} (${person.kind}) -> ${results[key].source ?? "NOT FOUND"}`);
    } catch (e: any) {
      results[key] = { photoUrl: null, source: null };
      missing++;
      console.error(`[${i + 1}/${people.length}] ${person.name} -> ERROR: ${e.message}`);
    }

    await sleep(400);
    if ((i + 1) % 50 === 0) writeFileSync(PHOTO_URLS_FILE, JSON.stringify(results, null, 2), "utf-8");
  }

  writeFileSync(PHOTO_URLS_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nWikipedia: ${foundWikipedia}, TMDB: ${foundTmdb}, missing: ${missing}, skipped (already resolved): ${skipped}`);

  console.log("\nApplying resolved photos to the DB...");
  let applied = 0;
  for (const person of people) {
    const key = `${person.kind}:${person.id}`;
    const entry = results[key];
    if (!entry?.photoUrl) continue;
    if (person.kind === "actor") await prisma.actor.update({ where: { id: person.id }, data: { photoUrl: entry.photoUrl } });
    else await prisma.director.update({ where: { id: person.id }, data: { photoUrl: entry.photoUrl } });
    applied++;
  }
  console.log(`Applied photos to ${applied} people.`);

  const stillMissing = people
    .filter((p) => !results[`${p.kind}:${p.id}`]?.photoUrl)
    .map((p) => ({ id: p.id, name: p.name, kind: p.kind }));
  writeFileSync(NEEDS_MANUAL_FILE, JSON.stringify(stillMissing, null, 2), "utf-8");
  console.log(`${stillMissing.length} people need a manual photo — written to ${NEEDS_MANUAL_FILE}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
