/**
 * Sources real poster/cover art for every seeded title, in fallback order:
 *   1. Wikipedia/Wikimedia — the article's lead image (low-res, for identification purposes,
 *      no API key needed). Two-step lookup: action=query&list=search to resolve the correct
 *      article (titles alone are ambiguous: "Dune" the film vs. the novel, "The Boys" TV series
 *      vs. comic, etc.), using the title's type/year as a disambiguating hint, then
 *      action=query&prop=pageimages to fetch that article's thumbnail.
 *   2. TMDB — only reached when Wikipedia has nothing. This is the one sanctioned exception to
 *      this project's "no external APIs" rule, scoped strictly to poster image lookups (never
 *      plot/cast/ratings/etc, which stay sourced from our own curated dataset). Requires
 *      TMDB_API_KEY in the environment; if it's unset, the TMDB step is skipped and the title
 *      is left for the generated placeholder.
 *   3. Neither found — leave it out of the results so seed.ts falls back to the generated
 *      retro/pop-art placeholder SVG (already a clear, obviously-not-a-real-poster placeholder,
 *      not a broken image).
 *
 * Output written to poster-urls.json, keyed by title id, each entry tagged with which source
 * (if any) resolved it — consumed by prisma/seed.ts at seed time.
 *
 * Incremental: re-running only (re)attempts titles that don't already have a resolved
 * posterUrl in the output file. Safe, and often necessary, to run more than once.
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { TITLES } from "../prisma/seed-data/titles";
import { BATCH_TITLES } from "../prisma/seed-data/batches";
import { POSTER_URLS_FILE, loadPosterResults, type PosterResult } from "./lib/posterUrls";

const ALL_TITLES = [...TITLES, ...BATCH_TITLES];

const USER_AGENT = "WhatShouldIWatch-PosterFetch/1.0 (educational demo project; contact: n/a)";
const OUT_FILE = POSTER_URLS_FILE;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// This environment's outbound connections intermittently drop mid-request (ECONNRESET) —
// unrelated to whether the title actually has a poster. Retry transient network failures a
// few times with backoff before giving up; a real 404/no-results response is not retried.
async function fetchWithRetry(url: string, init?: RequestInit, attempts = 4): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (attempt === attempts) return null;
      await sleep(500 * attempt);
    }
  }
  return null;
}

function typeHint(type: string, year: number): string {
  if (type === "movie") return `${year} film`;
  if (type === "show") return "TV series";
  if (type === "anime") return "anime";
  return "";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Wikipedia's search-relevance ranking can surface an entirely different title as the top hit
// for a generic/short query (e.g. "Kingdom" -> "Animal Kingdom (TV series)") rather than a
// disambiguated version of the query itself (e.g. "You" -> "You (TV series)", which is fine).
// Reject anything whose article title doesn't actually contain our title as a substring, so a
// mismatch falls through to TMDB instead of silently attaching the wrong poster.
function isPlausibleMatch(titleName: string, articleTitle: string): boolean {
  return normalize(articleTitle).includes(normalize(titleName));
}

// Both Wikipedia helpers swallow their own network errors (returning null) rather than
// throwing — a transient fetch failure on the Wikipedia step must not take out the TMDB
// fallback for that title too.
async function searchArticleTitle(name: string, hint: string): Promise<string | null> {
  const query = hint ? `${name} ${hint}` : name;
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&format=json&srlimit=1`;
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    const hit = data?.query?.search?.[0];
    return hit?.title ?? null;
  } catch {
    return null;
  }
}

async function fetchPageImage(articleTitle: string): Promise<string | null> {
  // pilicense=free is the API default, but pinned explicitly here: most film/show posters are
  // non-free (fair-use) content restricted by Wikipedia's own policy to on-wiki identification
  // use — deliberately never requesting pilicense=any, which would surface those instead.
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    articleTitle,
  )}&prop=pageimages&format=json&pithumbsize=500&pilicense=free&redirects=1`;
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

/**
 * TMDB fallback — poster image lookup only. Endpoint is chosen by actual format, not just the
 * `type` tag: "movie" and any standalone "anime" (has runtime_minutes, no seasons/episodes —
 * e.g. Spirited Away) search /search/movie; everything episodic ("show", and "anime" series like
 * Jujutsu Kaisen) searches /search/tv. Only the poster_path from the top search hit is used — no
 * other TMDB fields are read or stored. Swallows its own network errors (returns null).
 */
async function fetchTmdbPoster(
  name: string,
  type: string,
  year: number,
  isSeries: boolean,
): Promise<string | null> {
  if (!TMDB_API_KEY) return null;
  const isMovie = type === "movie" || (type === "anime" && !isSeries);
  const endpoint = isMovie ? "movie" : "tv";
  const yearParam = isMovie ? `&year=${year}` : `&first_air_date_year=${year}`;
  const url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
    name,
  )}${yearParam}&include_adult=false`;
  const res = await fetchWithRetry(url);
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    const posterPath = data?.results?.[0]?.poster_path;
    return posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!TMDB_API_KEY) {
    console.warn(
      "TMDB_API_KEY not set in server/.env — titles with no Wikipedia poster will be left for the generated placeholder instead of falling back to TMDB.\n",
    );
  }

  // Incremental: this environment's connection resets mean a single pass never resolves 100%
  // by chance alone. Titles already resolved in a prior run are kept as-is and skipped —
  // only titles still missing a poster are (re)attempted — so repeated runs converge instead
  // of re-rolling every title's network luck each time. Also covers every batch under
  // seed-data/batches/, not just the core seed, so a fresh batch's posters resolve in the same
  // pass without a separate step.
  const results: Record<string, PosterResult> = loadPosterResults();
  let foundWikipedia = 0;
  let foundTmdb = 0;
  let missing = 0;
  let skipped = 0;

  for (const [i, title] of ALL_TITLES.entries()) {
    const existing = results[title.id];
    if (existing?.posterUrl) {
      if (existing.source === "wikipedia") foundWikipedia++;
      else if (existing.source === "tmdb") foundTmdb++;
      skipped++;
      continue;
    }

    const hint = typeHint(title.type, title.release_year);
    try {
      let articleTitle = await searchArticleTitle(title.name, hint);
      if (articleTitle && !isPlausibleMatch(title.name, articleTitle)) {
        articleTitle = null;
      }
      let posterUrl: string | null = null;
      if (articleTitle) {
        posterUrl = await fetchPageImage(articleTitle);
      }

      if (posterUrl) {
        results[title.id] = { posterUrl, source: "wikipedia", articleTitle };
        foundWikipedia++;
        console.log(`[${i + 1}/${ALL_TITLES.length}] ${title.name} -> wikipedia (${articleTitle})`);
      } else {
        const isSeries = title.seasons != null || title.episodes != null;
        const tmdbUrl = await fetchTmdbPoster(title.name, title.type, title.release_year, isSeries);
        if (tmdbUrl) {
          results[title.id] = { posterUrl: tmdbUrl, source: "tmdb", articleTitle };
          foundTmdb++;
          console.log(`[${i + 1}/${ALL_TITLES.length}] ${title.name} -> tmdb`);
        } else {
          results[title.id] = { posterUrl: null, source: null, articleTitle };
          missing++;
          console.log(`[${i + 1}/${ALL_TITLES.length}] ${title.name} -> NOT FOUND (placeholder will be used)`);
        }
      }
    } catch (e: any) {
      console.error(`[${i + 1}/${ALL_TITLES.length}] ${title.name} -> ERROR: ${e.message}`);
      results[title.id] = { posterUrl: null, source: null, articleTitle: null };
      missing++;
    }
    // polite rate limit
    await sleep(400);
  }

  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(
    `\nDone. Wikipedia: ${foundWikipedia}, TMDB: ${foundTmdb}, missing (placeholder): ${missing}, already resolved (skipped): ${skipped}. Written to ${OUT_FILE}`,
  );
  if (missing > 0) {
    console.log("Run this script again to retry the titles still missing a poster.");
  }
}

main();
