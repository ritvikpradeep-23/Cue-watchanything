import { TAG_CATEGORY } from "../taxonomy";
import type { TagProfile, TitleTags } from "../types";

/**
 * Feature construction for the learned-weight-tuning model (see
 * cue-ml-weight-tuning-spec-Main.md). Shared between the training script and anything that
 * needs to reproduce its features for debugging — inference itself never calls this, only
 * training does (per spec section 4).
 *
 * Adapted from the spec's assumed data shape: the spec assumes a stored
 * `user_profile[category] = { preferred, avoided }` structure. This app's real stored profile
 * (QuizResponse.resultingTagProfile) is a flat TagProfile (tag -> weight) plus a separate
 * HardFilters object — there is no per-category preferred/avoided structure on disk. So:
 *   - "preferred" per category is derived here as the highest-weighted tag the user has in
 *     that category (ties broken by first-seen, which is deterministic given a fixed
 *     iteration order over a plain object's own keys).
 *   - "avoided" only has a real signal for genre (HardFilters.avoidGenres) in this app's
 *     current model — no other category has an explicit avoid-list, so every other category's
 *     avoided set is empty, never fabricated.
 */
export const FEATURE_CATEGORIES = [
  "genre",
  "mood",
  "pace",
  "tone",
  "cast_style",
  "content_rating",
  "era_setting",
  "structure",
  "sub_dub",
  "completion_status",
  "recency",
  "length_bucket",
  "runtime_bucket",
  "rewatch_value",
  "prestige_vs_blockbuster",
  "show_format",
  "season_commitment",
  "anthology_vs_continuous",
  "binge_vs_weekly",
  "episode_count_bucket",
  "demographic",
  "industry",
  "language",
] as const;

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number];

/** For each tag category the user has weighted, pick their single highest-weighted tag as
 * that category's "preferred" value. Zero/negative weights don't count as a preference. */
export function derivePreferredTagPerCategory(tagProfile: TagProfile): Partial<Record<string, string>> {
  const best: Record<string, { tag: string; weight: number }> = {};
  for (const [tag, weight] of Object.entries(tagProfile)) {
    if (weight <= 0) continue;
    const category = TAG_CATEGORY[tag];
    if (!category) continue;
    if (!best[category] || weight > best[category].weight) {
      best[category] = { tag, weight };
    }
  }
  const out: Partial<Record<string, string>> = {};
  for (const [category, entry] of Object.entries(best)) out[category] = entry.tag;
  return out;
}

export interface FeatureBuilderInput {
  preferredByCategory: Partial<Record<string, string>>;
  avoidGenres: string[];
  userLanguages: string[];
  titleTags: TitleTags;
  titleLanguages: string[];
}

/** One row of the training matrix: 1 = title matches the user's preferred value in that
 * category, -1 = user explicitly avoided this value (genre only, see above), 0 = no match or
 * the category doesn't apply to this title (e.g. runtime_bucket on a show). */
export function buildFeatureVector(input: FeatureBuilderInput): number[] {
  const tagsRecord = input.titleTags as unknown as Record<string, string[] | undefined>;

  return FEATURE_CATEGORIES.map((category) => {
    if (category === "language") {
      if (input.userLanguages.length === 0) return 0;
      return input.titleLanguages.some((l) => input.userLanguages.includes(l)) ? 1 : 0;
    }
    // season_commitment has no backing title.tags field in this app — quiz answers for it map
    // onto the existing length_bucket tag instead of a parallel category (see onboarding.ts) —
    // so it's always "not applicable to this title", exactly the spec's own defined behavior
    // for a category with no title_value.
    if (category === "season_commitment") return 0;

    const titleValues = tagsRecord[category];
    if (!titleValues || titleValues.length === 0) return 0;

    if (category === "genre" && titleValues.some((v) => input.avoidGenres.includes(v))) return -1;

    const preferred = input.preferredByCategory[category];
    if (preferred && titleValues.includes(preferred)) return 1;
    return 0;
  });
}
