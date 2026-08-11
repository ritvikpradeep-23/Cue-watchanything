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

/** score = sum over all tags the title has of the user's weight for that tag (0 if absent). */
export function scoreTitle(userProfile: TagProfile, title: TitleSeed): number {
  let score = 0;
  for (const tag of flattenTags(title.tags)) {
    score += userProfile[tag] ?? 0;
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
