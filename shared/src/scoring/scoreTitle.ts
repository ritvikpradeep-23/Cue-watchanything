import type { TagProfile, TitleSeed, TitleTags } from "../types";
import { TAG_CATEGORY } from "../taxonomy";

/** Flattens every tag category on a title into one list of tag strings. The newer optional
 * categories (runtime_bucket, rewatch_value, etc.) are missing entirely on titles seeded
 * before those fields existed — default to [] rather than spreading undefined, which would
 * throw. */
export function flattenTags(tags: TitleTags): string[] {
  return [
    ...tags.genre,
    ...tags.mood,
    ...tags.pace,
    ...tags.tone,
    ...tags.cast_style,
    ...tags.content_rating,
    ...tags.intensity,
    ...tags.era_setting,
    ...tags.structure,
    ...tags.sub_dub,
    ...tags.completion_status,
    ...tags.recency,
    ...tags.length_bucket,
    ...tags.love_factor,
    ...tags.industry,
    ...(tags.runtime_bucket ?? []),
    ...(tags.episode_count_bucket ?? []),
    ...(tags.rewatch_value ?? []),
    ...(tags.prestige_vs_blockbuster ?? []),
    ...(tags.show_format ?? []),
    ...(tags.anthology_vs_continuous ?? []),
    ...(tags.binge_vs_weekly ?? []),
    ...(tags.demographic ?? []),
  ];
}

/** score = sum over all tags the title has of the user's weight for that tag (0 if absent),
 * each optionally scaled by a learned per-category multiplier (see
 * cue-ml-weight-tuning-spec-Main.md) — how much a match in that category actually predicts a
 * like, derived from real swipe data rather than the hand-coded WEIGHT constants alone.
 * Omitting `learnedWeights` (or passing none) is a no-op multiplier of 1 for every category,
 * so every existing caller/test is unaffected — this is the ONLY thing the learned-weight
 * layer touches, per that spec's explicit scope limit. */
export function scoreTitle(userProfile: TagProfile, title: TitleSeed, learnedWeights?: Record<string, number>): number {
  let score = 0;
  for (const tag of flattenTags(title.tags)) {
    const base = userProfile[tag] ?? 0;
    if (base === 0) continue;
    const multiplier = learnedWeights ? (learnedWeights[TAG_CATEGORY[tag]] ?? 1) : 1;
    score += base * multiplier;
  }
  return score;
}

export interface ScoreBreakdown {
  total: number;
  /** same total as scoreTitle, grouped by taxonomy category (genre, mood, pace, ...) — the
   * axes for a "why this matches you" radar chart. */
  byCategory: Record<string, number>;
}

/** Same score as scoreTitle, but grouped by tag category instead of summed into one number.
 * Only reads `.tags` — accepts anything tag-shaped (an ApiTitle from the client, a TitleSeed
 * fixture, etc.), not the full TitleSeed. */
export function scoreTitleBreakdown(userProfile: TagProfile, title: { tags: TitleTags }): ScoreBreakdown {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const tag of flattenTags(title.tags)) {
    const weight = userProfile[tag] ?? 0;
    total += weight;
    const category = TAG_CATEGORY[tag] ?? "other";
    byCategory[category] = (byCategory[category] ?? 0) + weight;
  }
  return { total, byCategory };
}
