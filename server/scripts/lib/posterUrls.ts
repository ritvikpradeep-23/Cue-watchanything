import { existsSync, readFileSync } from "fs";
import path from "path";

/** Single shared location for resolved poster art, keyed by title id — written by
 * fetch-posters.ts, read by seed.ts and seed-batches.ts. Gitignored (local/CI artifact). */
export const POSTER_URLS_FILE = path.resolve(__dirname, "../poster-urls.json");

export type PosterResult = {
  posterUrl: string | null;
  source: "wikipedia" | "tmdb" | null;
  articleTitle: string | null;
};

export function loadPosterResults(): Record<string, PosterResult> {
  if (!existsSync(POSTER_URLS_FILE)) return {};
  return JSON.parse(readFileSync(POSTER_URLS_FILE, "utf-8")) as Record<string, PosterResult>;
}

/** Flattened id -> posterUrl, only for titles that actually resolved to a real image. */
export function loadResolvedPosterUrls(): Record<string, string> {
  const raw = loadPosterResults();
  const resolved: Record<string, string> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (entry.posterUrl) resolved[id] = entry.posterUrl;
  }
  return resolved;
}
