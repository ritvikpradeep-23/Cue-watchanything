/** TMDB helpers for the actor-filmography-driven expansion pipeline (distinct from tmdb.ts's
 * per-title metadata lookup and fetch-posters.ts's poster-only lookup). Covers person search,
 * combined credits, watch-providers (platform verification), and certifications.
 *
 * This environment's connection to api.themoviedb.org resets intermittently (confirmed: same
 * request succeeds on retry within a few seconds) — every call here goes through the same
 * generous retry+backoff as the rest of the TMDB scripts, not a stricter one. */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Circuit breaker across calls (not just retries within one call): this environment's
 * connection to TMDB occasionally goes through a longer bad patch than any single call's
 * retry budget can ride out. Track consecutive fully-failed calls; once several in a row
 * exhaust their own retries, force a long cooldown before the next call even starts, and
 * give that first post-cooldown call extra attempts. Resets on any success. */
let consecutiveCallFailures = 0;

async function fetchJson(url: string, attempts = 8): Promise<any | null> {
  const safeUrl = url.replace(/api_key=[^&]+/, "api_key=***");

  if (consecutiveCallFailures >= 3) {
    const cooldownMs = Math.min(60000, 15000 * (consecutiveCallFailures - 2));
    console.warn(`  [tmdb] ${consecutiveCallFailures} consecutive call failures, cooling down ${cooldownMs / 1000}s before retrying`);
    await sleep(cooldownMs);
    attempts += 4;
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 429) {
          // real rate limit — back off much longer than a transient connection reset would need
          console.warn(`  [tmdb] 429 rate limited on ${safeUrl}, backing off 5s (attempt ${attempt}/${attempts})`);
          await sleep(5000);
          continue;
        }
        console.warn(`  [tmdb] HTTP ${res.status} on ${safeUrl}`);
        consecutiveCallFailures = 0; // a real HTTP response means the connection itself is fine
        return null;
      }
      consecutiveCallFailures = 0;
      return await res.json();
    } catch (e: any) {
      if (attempt === attempts) {
        consecutiveCallFailures++;
        console.warn(`  [tmdb] gave up after ${attempts} attempts (${e?.message ?? "unknown error"}): ${safeUrl}`);
        return null;
      }
      await sleep(500 * attempt);
    }
  }
  return null;
}

export interface TmdbPerson {
  id: number;
  name: string;
}

/** Best-match person search, restricted to actual actors. */
export async function searchPerson(name: string): Promise<TmdbPerson | null> {
  if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY not set");
  const data = await fetchJson(`${BASE}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`);
  const hit = (data?.results ?? []).find((p: any) => p.known_for_department === "Acting") ?? data?.results?.[0];
  if (!hit?.id) return null;
  return { id: hit.id, name: hit.name };
}

export interface CombinedCredit {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  releaseDate: string | null;
  genreIds: number[];
  order: number;
  originalLanguage: string;
}

/** Every acting credit for a person, movies + TV combined. Filtering (year, order, dedup) is
 * the caller's job — this just returns the raw list. */
export async function getCombinedCredits(personId: number): Promise<CombinedCredit[]> {
  const data = await fetchJson(`${BASE}/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}`);
  const cast: any[] = data?.cast ?? [];
  return cast
    .filter((c) => c.media_type === "movie" || c.media_type === "tv")
    .map((c) => ({
      id: c.id,
      title: c.title ?? c.name,
      mediaType: c.media_type,
      releaseDate: c.release_date || c.first_air_date || null,
      genreIds: c.genre_ids ?? [],
      order: typeof c.order === "number" ? c.order : 99,
      originalLanguage: c.original_language ?? "",
    }));
}

/** Canonical-platform allow-list — matched against TMDB's free-text provider_name, never the
 * reverse (no fuzzy "does this look like a platform" guessing). Only `flatrate` (subscription)
 * offers count; `rent`/`buy` show up almost universally regardless of real subscription
 * inclusion and would defeat the point of verifying availability. */
const PROVIDER_ALLOWLIST: { match: RegExp; platform: string }[] = [
  { match: /netflix/i, platform: "Netflix" },
  { match: /amazon prime video|prime video/i, platform: "Prime Video" },
  { match: /disney\+? ?hotstar|hotstar/i, platform: "Disney+ Hotstar" },
  { match: /apple tv/i, platform: "Apple TV" },
  { match: /^hulu/i, platform: "Hulu" },
  { match: /crunchyroll/i, platform: "Crunchyroll" },
  { match: /hidive/i, platform: "HIDIVE" },
  { match: /hbo max|^max$/i, platform: "HBO Max" },
];

/** Checks flatrate providers across the given regions (in order), returns every canonical
 * platform found on ANY of them, deduped. Empty result = genuinely not verified as available
 * on any of our 8 platforms — the caller must skip the title, not guess. */
export async function getWatchProviders(
  tmdbId: number,
  mediaType: "movie" | "tv",
  regions: string[],
): Promise<string[]> {
  const data = await fetchJson(`${BASE}/${mediaType}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`);
  const found = new Set<string>();
  for (const region of regions) {
    const flatrate: any[] = data?.results?.[region]?.flatrate ?? [];
    for (const p of flatrate) {
      const match = PROVIDER_ALLOWLIST.find((entry) => entry.match.test(p.provider_name ?? ""));
      if (match) found.add(match.platform);
    }
  }
  return [...found];
}

export interface TmdbTitleDetails {
  overview: string;
  cast: string[];
  runtimeMinutes: number | null;
  seasons: number | null;
  episodes: number | null;
  belongsToCollection: boolean;
  status: string | null;
  productionCountries: string[];
}

/** Full details for one title — plot/cast/runtime (same fields tmdb.ts already pulls) plus the
 * extra signals the heuristic tagging rules need: belongs_to_collection (real franchise signal,
 * not guessed) and status (real ongoing/completed signal for shows). */
export async function getTitleDetails(tmdbId: number, mediaType: "movie" | "tv"): Promise<TmdbTitleDetails | null> {
  const data = await fetchJson(`${BASE}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
  if (!data) return null;
  return {
    overview: data.overview ?? "",
    cast: (data.credits?.cast ?? []).slice(0, 5).map((c: any) => c.name).filter(Boolean),
    runtimeMinutes: mediaType === "movie" ? (data.runtime ?? null) : null,
    seasons: mediaType === "tv" ? (data.number_of_seasons ?? null) : null,
    episodes: mediaType === "tv" ? (data.number_of_episodes ?? null) : null,
    belongsToCollection: mediaType === "movie" && !!data.belongs_to_collection,
    status: mediaType === "tv" ? (data.status ?? null) : null,
    productionCountries: (data.production_countries ?? data.origin_country?.map((c: string) => ({ iso_3166_1: c })) ?? []).map(
      (c: any) => c.iso_3166_1 ?? c,
    ),
  };
}

/** Real content certification for a title/region — used for content_rating where available.
 * Returns null (not a guess) when TMDB has no certification on file for that region. */
export async function getCertification(
  tmdbId: number,
  mediaType: "movie" | "tv",
  region: string,
): Promise<string | null> {
  if (mediaType === "movie") {
    const data = await fetchJson(`${BASE}/movie/${tmdbId}/release_dates?api_key=${TMDB_API_KEY}`);
    const entry = (data?.results ?? []).find((r: any) => r.iso_3166_1 === region);
    const cert = entry?.release_dates?.find((d: any) => d.certification)?.certification;
    return cert || null;
  }
  const data = await fetchJson(`${BASE}/tv/${tmdbId}/content_ratings?api_key=${TMDB_API_KEY}`);
  const entry = (data?.results ?? []).find((r: any) => r.iso_3166_1 === region);
  return entry?.rating || null;
}
