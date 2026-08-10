import type { Genre, Language, Platform, TitleType } from "../taxonomy";
import type { TagProfile, TitleSeed } from "../types";
import { scoreTitle } from "./scoreTitle";

export interface HardFilters {
  /** user's Q1 answer ("movie" | "show" | "anime") — title.type must match exactly. Omit
   * (or "surprise") to skip the filter entirely. This used to only pick the type-specific
   * follow-up question and was never enforced here, which let the wrong type slip into the
   * deck/top-3 — it's a hard exclusion now, same tier as platforms/lengthPreference below. */
  type?: TitleType;
  /** user's selected platforms (Q19) — title.platforms must intersect this set */
  platforms?: Platform[];
  /** user's total-time-commitment answer (Q20) */
  lengthPreference?: "single-sitting" | "short-binge" | "multi-season" | "no-cap";
  /** user's language selection — title.languages must intersect this set. Omit/empty, or
   * include "any" (the "don't mind subtitles" option), to skip the filter entirely. */
  languages?: Language[];
  /** genres marked "avoid" that weren't rerouted by the conflict-check — titles primarily
   * tagged with any of these are excluded outright, not just down-weighted. */
  avoidGenres?: Genre[];
}

export function passesHardFilters(title: TitleSeed, filters: HardFilters): boolean {
  if (filters.type && title.type !== filters.type) return false;
  if (filters.platforms && filters.platforms.length > 0) {
    const intersects = title.platforms.some((p) => filters.platforms!.includes(p));
    if (!intersects) return false;
  }
  if (filters.lengthPreference === "single-sitting") {
    if (title.tags.length_bucket.includes("long-runner")) return false;
  }
  if (filters.languages && filters.languages.length > 0 && !filters.languages.includes("any" as Language)) {
    const intersects = title.languages.some((l) => filters.languages!.includes(l));
    if (!intersects) return false;
  }
  if (filters.avoidGenres && filters.avoidGenres.length > 0) {
    const intersectsAvoid = title.tags.genre.some((g) => filters.avoidGenres!.includes(g));
    if (intersectsAvoid) return false;
  }
  return true;
}

/** Below this many relevant matches, backfill with the next-best (still score > 0) titles so
 * the deck never collapses to near-nothing on a sparse profile. */
const MIN_DECK = 12;
/** Hard ceiling on deck size — a big drop from the old fixed 30-50 floor: a smaller,
 * higher-confidence deck beats padding it out with weak matches. */
const MAX_DECK = 50;
/** A title must score at least this fraction of the top scorer's score to count as
 * "relevant" — this is what shrinks the deck instead of always filling it. */
const RELEVANCE_RATIO = 0.35;

export interface BuildDeckOptions {
  excludedIds?: Set<string>;
  filters?: HardFilters;
  deckSize?: number; // ceiling only now, clamped to [15, 50] — see MIN_DECK/MAX_DECK
}

/** Scores, filters, and ranks the full catalog down to a swipeable shortlist. Only titles
 * that clear a real relevance bar make the cut — a smaller deck of 15-25 confident matches
 * beats always padding out to 40-50 with weak ones. */
export function buildDeck(
  userProfile: TagProfile,
  allTitles: TitleSeed[],
  options: BuildDeckOptions = {},
): TitleSeed[] {
  const excludedIds = options.excludedIds ?? new Set<string>();
  const filters = options.filters ?? {};
  const maxSize = Math.min(MAX_DECK, Math.max(15, options.deckSize ?? MAX_DECK));

  const eligible = allTitles.filter(
    (t) => !excludedIds.has(t.id) && passesHardFilters(t, filters),
  );

  const scored = eligible
    .map((title) => ({ title, score: scoreTitle(userProfile, title) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const topScore = scored[0].score;
  const relevant =
    topScore > 0
      ? scored.filter((s) => s.score >= topScore * RELEVANCE_RATIO)
      : scored.filter((s) => s.score > 0);

  const limited = relevant.slice(0, maxSize);
  if (limited.length >= MIN_DECK) return limited.map((s) => s.title);

  // Sparse profile: backfill with the next-best positive-scoring titles below the relevance
  // bar rather than shipping a near-empty deck.
  const limitedIds = new Set(limited.map((s) => s.title.id));
  const backfillPool = scored.filter((s) => s.score > 0 && !limitedIds.has(s.title.id));
  const backfilled = [...limited, ...backfillPool.slice(0, MIN_DECK - limited.length)];
  return backfilled.slice(0, maxSize).map((s) => s.title);
}
