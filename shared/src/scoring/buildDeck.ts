import type { Platform } from "../taxonomy";
import type { TagProfile, TitleSeed } from "../types";
import { scoreTitle } from "./scoreTitle";

export interface HardFilters {
  /** user's selected platforms (Q19) — title.platforms must intersect this set */
  platforms?: Platform[];
  /** user's total-time-commitment answer (Q20) */
  lengthPreference?: "single-sitting" | "short-binge" | "multi-season" | "no-cap";
}

export function passesHardFilters(title: TitleSeed, filters: HardFilters): boolean {
  if (filters.platforms && filters.platforms.length > 0) {
    const intersects = title.platforms.some((p) => filters.platforms!.includes(p));
    if (!intersects) return false;
  }
  if (filters.lengthPreference === "single-sitting") {
    if (title.tags.length_bucket.includes("long-runner")) return false;
  }
  return true;
}

export interface BuildDeckOptions {
  excludedIds?: Set<string>;
  filters?: HardFilters;
  deckSize?: number; // default 40, clamped to [30, 50]
}

/** Scores, filters, and ranks the full catalog down to a swipeable shortlist. */
export function buildDeck(
  userProfile: TagProfile,
  allTitles: TitleSeed[],
  options: BuildDeckOptions = {},
): TitleSeed[] {
  const excludedIds = options.excludedIds ?? new Set<string>();
  const filters = options.filters ?? {};
  const deckSize = Math.min(50, Math.max(30, options.deckSize ?? 40));

  const eligible = allTitles.filter(
    (t) => !excludedIds.has(t.id) && passesHardFilters(t, filters),
  );

  const scored = eligible
    .map((title) => ({ title, score: scoreTitle(userProfile, title) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, deckSize).map((s) => s.title);
}
