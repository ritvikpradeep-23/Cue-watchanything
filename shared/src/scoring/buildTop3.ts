import type { TagProfile, TitleSeed } from "../types";
import { TAG_CATEGORY } from "../taxonomy";
import { HardFilters, passesHardFilters } from "./buildDeck";
import { flattenTags, scoreTitle } from "./scoreTitle";

export interface TieBreakQuestion {
  titleA: TitleSeed;
  titleB: TitleSeed;
  /** the tag pulled from titleA's own tags that differentiates it from titleB */
  tagA: string;
  /** the tag pulled from titleB's own tags that differentiates it from titleA */
  tagB: string;
  prompt: string;
}

export interface BuildTop3Options {
  excludedIds?: Set<string>;
  filters?: HardFilters;
  /** 0 = stick close to what worked, 1 = open to trying something different */
  exploreExploitDial?: number;
  /** score-proximity threshold for triggering a tie-break, e.g. 0.05 = within 5% */
  tieThreshold?: number;
  /** id of the title the user chose when the tie-break question fired */
  tieBreakWinnerId?: string;
  /** learned per-category weight multipliers, see scoreTitle — omit for unaffected behavior */
  learnedWeights?: Record<string, number>;
}

const PREFERRED_TIE_CATEGORIES = ["mood", "love_factor", "genre", "tone", "pace"];

/** Categories that carry "taste flavor" — used to judge diversity between titles.
 * Deliberately excludes structural/filter-like categories (content_rating, era_setting,
 * structure, sub_dub, completion_status, recency, length_bucket) that are shared by
 * coincidence rather than taste and would otherwise swamp the comparison. */
const FLAVOR_CATEGORIES = new Set(["genre", "mood", "pace", "tone", "cast_style", "love_factor"]);

export function flavorTags(title: { tags: TitleSeed["tags"] }): string[] {
  return flattenTags(title.tags).filter((t) => FLAVOR_CATEGORIES.has(TAG_CATEGORY[t] ?? ""));
}

/** Count of "taste flavor" tags b shares with a — used both for buildTop3's diversity swap
 * and for findSimilarTitles's "more like this" ranking. Only reads `.tags`, so it works with
 * both a server-side TitleSeed (snake_case fields) and a client-side ApiTitle (camelCase). */
export function sharedTagCount(a: { tags: TitleSeed["tags"] }, b: { tags: TitleSeed["tags"] }): number {
  const tagsA = new Set(flavorTags(a));
  const tagsB = flavorTags(b);
  return tagsB.filter((t) => tagsA.has(t)).length;
}

/** Picks one differentiating tag from each title's own tags, preferring taste-flavored categories. */
function pickDifferentiatingTags(a: TitleSeed, b: TitleSeed): { tagA: string; tagB: string } | null {
  const tagsA = flattenTags(a.tags);
  const tagsB = flattenTags(b.tags);
  const setB = new Set(tagsB);
  const setA = new Set(tagsA);

  const onlyA = tagsA.filter((t) => !setB.has(t));
  const onlyB = tagsB.filter((t) => !setA.has(t));
  if (onlyA.length === 0 || onlyB.length === 0) return null;

  const rank = (t: string) => {
    const idx = PREFERRED_TIE_CATEGORIES.indexOf(TAG_CATEGORY[t] ?? "");
    return idx === -1 ? PREFERRED_TIE_CATEGORIES.length : idx;
  };
  onlyA.sort((x, y) => rank(x) - rank(y));
  onlyB.sort((x, y) => rank(x) - rank(y));

  return { tagA: onlyA[0], tagB: onlyB[0] };
}

function buildTieBreakQuestion(a: TitleSeed, b: TitleSeed): TieBreakQuestion | null {
  const diff = pickDifferentiatingTags(a, b);
  if (!diff) return null;
  return {
    titleA: a,
    titleB: b,
    tagA: diff.tagA,
    tagB: diff.tagB,
    prompt: `Two are close: lean more toward "${diff.tagA.replace(/-/g, " ")}" (${a.name}) or "${diff.tagB.replace(/-/g, " ")}" (${b.name})?`,
  };
}

interface ScoredTitle {
  title: TitleSeed;
  score: number;
}

function rankEligible(
  sessionProfile: TagProfile,
  allTitles: TitleSeed[],
  excludedIds: Set<string>,
  filters: HardFilters,
): ScoredTitle[] {
  const eligible = allTitles.filter((t) => !excludedIds.has(t.id) && passesHardFilters(t, filters));
  return eligible
    .map((title) => ({ title, score: scoreTitle(sessionProfile, title) }))
    .sort((a, b) => b.score - a.score);
}

export interface BuildTop3Result {
  picks: TitleSeed[];
  /** set only when two candidates are too close to call and no tieBreakWinnerId was supplied yet */
  pendingTieBreak: TieBreakQuestion | null;
}

/**
 * Narrows the catalog to exactly 3 titles.
 * Call once without tieBreakWinnerId; if `pendingTieBreak` comes back non-null, ask the
 * user that question and call again with tieBreakWinnerId set to resolve it.
 */
export function buildTop3(
  sessionProfile: TagProfile,
  allTitles: TitleSeed[],
  options: BuildTop3Options = {},
): BuildTop3Result {
  const excludedIds = options.excludedIds ?? new Set<string>();
  const filters = options.filters ?? {};
  const dial = options.exploreExploitDial ?? 0.3;
  const threshold = options.tieThreshold ?? 0.05;

  const ranked = rankEligible(sessionProfile, allTitles, excludedIds, filters);
  if (ranked.length === 0) return { picks: [], pendingTieBreak: null };

  const pick1 = ranked[0].title;
  const remaining = ranked.slice(1);

  const stickClose = dial < 0.5;

  let pick2Idx = 0;
  let pick3Idx = 1;
  let usedDiversitySwap = false;

  if (!stickClose && remaining.length > 2) {
    // find the most tag-diverse title (relative to pick1) among the remaining candidates
    // to swap in as the #3 slot instead of the raw #3 scorer.
    let mostDiverseIdx = 2;
    let fewestShared = Infinity;
    for (let i = 1; i < remaining.length; i++) {
      const shared = sharedTagCount(pick1, remaining[i].title);
      if (shared < fewestShared) {
        fewestShared = shared;
        mostDiverseIdx = i;
      }
    }
    pick3Idx = mostDiverseIdx;
    usedDiversitySwap = true;
  }

  // Tie-break only applies to the raw-ranking cutoff (rank #3 vs #4). Once the explore/exploit
  // dial has deliberately swapped in a diverse pick, that choice supersedes the tie question.
  const boundaryScore = remaining[pick3Idx]?.score ?? 0;
  const nextScore = remaining.find((_, i) => i !== pick2Idx && i !== pick3Idx)?.score;

  if (
    !usedDiversitySwap &&
    !options.tieBreakWinnerId &&
    nextScore !== undefined &&
    boundaryScore > 0 &&
    Math.abs(boundaryScore - nextScore) / boundaryScore <= threshold
  ) {
    const contenderIdx = remaining.findIndex(
      (r, i) => i !== pick2Idx && i !== pick3Idx && r.score === nextScore,
    );
    if (contenderIdx !== -1) {
      const q = buildTieBreakQuestion(remaining[pick3Idx].title, remaining[contenderIdx].title);
      if (q) return { picks: [], pendingTieBreak: q };
    }
  }

  let pick3 = remaining[pick3Idx].title;
  if (options.tieBreakWinnerId) {
    const winner = remaining.find((r) => r.title.id === options.tieBreakWinnerId);
    if (winner) pick3 = winner.title;
  }

  const pick2 = remaining[pick2Idx].title;

  const picks = [pick1, pick2, pick3].filter(
    (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i,
  );

  // backfill if de-duplication left us short (small catalogs / heavy overlap)
  for (const r of remaining) {
    if (picks.length >= 3) break;
    if (!picks.find((p) => p.id === r.title.id)) picks.push(r.title);
  }

  return { picks: picks.slice(0, 3), pendingTieBreak: null };
}
