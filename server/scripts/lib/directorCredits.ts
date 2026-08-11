import { existsSync, readFileSync } from "fs";
import path from "path";

/** Resolved via TMDB only — Wikipedia infobox parsing for director credits is too fragile to
 * do reliably (unlike the poster pipeline's page-image lookup, which is a single well-defined
 * API field). Titles TMDB can't resolve are left out of this file; the backfill script leaves
 * their Title.directors empty rather than guessing. Gitignored (local/CI artifact), same
 * convention as poster-urls.json. */
export const DIRECTOR_CREDITS_FILE = path.resolve(__dirname, "../director-credits.json");

export type DirectorCreditsResult = {
  directors: string[]; // [] means "resolved, this title genuinely has no director credit on TMDB"
  resolved: boolean; // false means "not attempted or TMDB lookup failed" — distinct from a real []
};

export function loadDirectorCredits(): Record<string, DirectorCreditsResult> {
  if (!existsSync(DIRECTOR_CREDITS_FILE)) return {};
  return JSON.parse(readFileSync(DIRECTOR_CREDITS_FILE, "utf-8")) as Record<string, DirectorCreditsResult>;
}
