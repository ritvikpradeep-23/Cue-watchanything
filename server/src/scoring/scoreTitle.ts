import type { TagProfile, TitleSeed, TitleTags } from "@watch-recommender/shared";

/** Flattens every tag category on a title into one list of tag strings. */
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
