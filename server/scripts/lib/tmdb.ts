/** Shared TMDB fetch helpers for metadata import (distinct from fetch-posters.ts's
 * poster-only TMDB usage — this covers plot/cast/year/original-language for the multi-language
 * dataset expansion, per the explicitly scoped exception for that purpose). */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url);
      return res;
    } catch {
      if (attempt === attempts) return null;
      await sleep(500 * attempt);
    }
  }
  return null;
}

export interface TmdbMetadata {
  overview: string;
  cast: string[];
  releaseYear: number;
  originalLanguage: string;
  runtimeMinutes: number | null;
  seasons: number | null;
  episodes: number | null;
}

/** Searches TMDB for a movie/tv title, then fetches full details + top cast in one follow-up
 * call. Returns null (rather than throwing) on any missing/ambiguous result — callers flag
 * that as an incomplete import instead of guessing. */
export async function fetchTmdbMetadata(
  name: string,
  tmdbType: "movie" | "tv",
  year: number,
): Promise<TmdbMetadata | null> {
  if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY not set in server/.env");

  const yearParam = tmdbType === "movie" ? `&year=${year}` : `&first_air_date_year=${year}`;
  const searchUrl = `${BASE}/search/${tmdbType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}${yearParam}&include_adult=false`;
  const searchRes = await fetchWithRetry(searchUrl);
  if (!searchRes || !searchRes.ok) return null;
  const searchData = await searchRes.json();
  const hit = searchData?.results?.[0];
  if (!hit?.id) return null;

  const detailUrl = `${BASE}/${tmdbType}/${hit.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  const detailRes = await fetchWithRetry(detailUrl);
  if (!detailRes || !detailRes.ok) return null;
  const detail = await detailRes.json();

  const overview: string = detail.overview ?? "";
  const cast: string[] = (detail.credits?.cast ?? []).slice(0, 5).map((c: any) => c.name).filter(Boolean);
  const dateStr: string = tmdbType === "movie" ? detail.release_date : detail.first_air_date;
  const releaseYear = dateStr ? Number(dateStr.slice(0, 4)) : year;

  return {
    overview,
    cast,
    releaseYear,
    originalLanguage: detail.original_language ?? "",
    runtimeMinutes: tmdbType === "movie" ? (detail.runtime ?? null) : null,
    seasons: tmdbType === "tv" ? (detail.number_of_seasons ?? null) : null,
    episodes: tmdbType === "tv" ? (detail.number_of_episodes ?? null) : null,
  };
}
