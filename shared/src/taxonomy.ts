/**
 * Single source of truth for the tag vocabulary. Both the quiz (client) and the
 * scoring engine (server) import this — never redefine tag strings elsewhere.
 */

export const GENRES = [
  "comedy",
  "drama",
  "thriller",
  "horror",
  "sci-fi",
  "fantasy",
  "romance",
  "action",
  "documentary",
  "mystery",
  "slice-of-life",
] as const;

export const MOODS = [
  "light",
  "dark",
  "feel-good",
  "intense",
  "funny-witty",
  "funny-silly",
  "cerebral-mystery",
  "cerebral-ideas",
  "comfort-background",
  "comfort-escapist",
] as const;

export const PACES = ["slow-burn", "fast-paced"] as const;

export const TONES = ["gritty", "hopeful", "mixed"] as const;

export const CAST_STYLES = ["ensemble", "single-protagonist"] as const;

export const CONTENT_RATINGS = ["family", "teen", "mature"] as const;

export const INTENSITIES = ["graphic-violence", "heavy-themes"] as const;

export const ERA_SETTINGS = [
  "modern",
  "historical",
  "fantasy-world",
  "sci-fi-future",
] as const;

export const STRUCTURES = [
  "episodic",
  "serialized",
  "standalone",
  "franchise",
] as const;

export const SUB_DUB = ["sub-available", "dub-available"] as const;

export const COMPLETION_STATUSES = ["ongoing", "completed"] as const;

export const RECENCIES = ["new-buzzy", "hidden-gem", "classic"] as const;

export const LENGTH_BUCKETS = [
  "single-sitting",
  "short-binge",
  "multi-season",
  "long-runner",
] as const;

export const LOVE_FACTORS = [
  "characters",
  "plot-twists",
  "world-building",
  "humor",
  "emotional-weight",
] as const;

export const TITLE_TYPES = ["show", "movie", "anime"] as const;

export const PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Disney+ Hotstar",
  "Apple TV",
  "Hulu",
  "Crunchyroll",
  "HIDIVE",
  "HBO Max",
] as const;

/** Original/audio language a title is available in — a HARD FILTER (see scoring/buildDeck),
 * never a weighted tag. "any" is a quiz-only sentinel meaning "don't filter by language". */
export const LANGUAGES = [
  "English",
  "Hindi",
  "Telugu",
  "Tamil",
  "Malayalam",
  "Korean",
  "Japanese",
  "Spanish",
  "German",
  "French",
] as const;

/** Regional film/TV industry a title was produced in — a soft weighted preference (see
 * TitleTags.industry), same pattern as genre. */
export const INDUSTRIES = [
  "Hollywood",
  "Bollywood",
  "Tollywood",
  "Kollywood",
  "Mollywood",
  "Korean Cinema",
  "Japanese Cinema",
  "Japanese Animation",
  "European Cinema",
  "Latin American Cinema",
] as const;

/** Derived purely from runtime_minutes (movies) — computed at seed-build time, never guessed. */
export const RUNTIME_BUCKETS = ["short", "standard", "long", "epic"] as const;
export const REWATCH_VALUES = ["one-time", "rewatchable"] as const;
export const PRESTIGE_VS_BLOCKBUSTER = ["prestige", "blockbuster"] as const;
export const SHOW_FORMATS = ["sitcom-ensemble", "prestige-drama", "thriller-suspense", "procedural"] as const;
export const ANTHOLOGY_VS_CONTINUOUS = ["anthology", "continuous-storyline"] as const;
export const BINGE_VS_WEEKLY = ["binge-preferred", "weekly-preferred"] as const;
/** Derived purely from episodes (anime) — computed at seed-build time, never guessed. */
export const EPISODE_COUNT_BUCKETS = ["short", "standard", "long-runner"] as const;
export const DEMOGRAPHICS = ["shonen", "seinen", "shojo", "josei"] as const;

export type Genre = (typeof GENRES)[number];
export type Mood = (typeof MOODS)[number];
export type Pace = (typeof PACES)[number];
export type Tone = (typeof TONES)[number];
export type CastStyle = (typeof CAST_STYLES)[number];
export type ContentRating = (typeof CONTENT_RATINGS)[number];
export type Intensity = (typeof INTENSITIES)[number];
export type EraSetting = (typeof ERA_SETTINGS)[number];
export type Structure = (typeof STRUCTURES)[number];
export type SubDub = (typeof SUB_DUB)[number];
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];
export type Recency = (typeof RECENCIES)[number];
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];
export type LoveFactor = (typeof LOVE_FACTORS)[number];
export type TitleType = (typeof TITLE_TYPES)[number];
export type Platform = (typeof PLATFORMS)[number];
export type Language = (typeof LANGUAGES)[number];
export type Industry = (typeof INDUSTRIES)[number];
export type RuntimeBucket = (typeof RUNTIME_BUCKETS)[number];
export type RewatchValue = (typeof REWATCH_VALUES)[number];
export type PrestigeVsBlockbuster = (typeof PRESTIGE_VS_BLOCKBUSTER)[number];
export type ShowFormat = (typeof SHOW_FORMATS)[number];
export type AnthologyVsContinuous = (typeof ANTHOLOGY_VS_CONTINUOUS)[number];
export type BingeVsWeekly = (typeof BINGE_VS_WEEKLY)[number];
export type EpisodeCountBucket = (typeof EPISODE_COUNT_BUCKETS)[number];
export type Demographic = (typeof DEMOGRAPHICS)[number];

/** Every valid tag string across every category, flattened — used for delta/weight maps. */
export type Tag =
  | Genre
  | Mood
  | Pace
  | Tone
  | CastStyle
  | ContentRating
  | Intensity
  | EraSetting
  | Structure
  | SubDub
  | CompletionStatus
  | Recency
  | LengthBucket
  | LoveFactor
  | Industry
  | RuntimeBucket
  | RewatchValue
  | PrestigeVsBlockbuster
  | ShowFormat
  | AnthologyVsContinuous
  | BingeVsWeekly
  | EpisodeCountBucket
  | Demographic;

export const ALL_TAGS: Tag[] = [
  ...GENRES,
  ...MOODS,
  ...PACES,
  ...TONES,
  ...CAST_STYLES,
  ...CONTENT_RATINGS,
  ...INTENSITIES,
  ...ERA_SETTINGS,
  ...STRUCTURES,
  ...SUB_DUB,
  ...COMPLETION_STATUSES,
  ...RECENCIES,
  ...LENGTH_BUCKETS,
  ...LOVE_FACTORS,
  ...INDUSTRIES,
  ...RUNTIME_BUCKETS,
  ...REWATCH_VALUES,
  ...PRESTIGE_VS_BLOCKBUSTER,
  ...SHOW_FORMATS,
  ...ANTHOLOGY_VS_CONTINUOUS,
  ...BINGE_VS_WEEKLY,
  ...EPISODE_COUNT_BUCKETS,
  ...DEMOGRAPHICS,
];

/** tag -> which taxonomy category it belongs to (used by tag-check question generation) */
export const TAG_CATEGORY: Record<string, string> = {
  ...Object.fromEntries(GENRES.map((t) => [t, "genre"])),
  ...Object.fromEntries(MOODS.map((t) => [t, "mood"])),
  ...Object.fromEntries(PACES.map((t) => [t, "pace"])),
  ...Object.fromEntries(TONES.map((t) => [t, "tone"])),
  ...Object.fromEntries(CAST_STYLES.map((t) => [t, "cast_style"])),
  ...Object.fromEntries(CONTENT_RATINGS.map((t) => [t, "content_rating"])),
  ...Object.fromEntries(INTENSITIES.map((t) => [t, "intensity"])),
  ...Object.fromEntries(ERA_SETTINGS.map((t) => [t, "era_setting"])),
  ...Object.fromEntries(STRUCTURES.map((t) => [t, "structure"])),
  ...Object.fromEntries(SUB_DUB.map((t) => [t, "sub_dub"])),
  ...Object.fromEntries(COMPLETION_STATUSES.map((t) => [t, "completion_status"])),
  ...Object.fromEntries(RECENCIES.map((t) => [t, "recency"])),
  ...Object.fromEntries(LENGTH_BUCKETS.map((t) => [t, "length_bucket"])),
  ...Object.fromEntries(LOVE_FACTORS.map((t) => [t, "love_factor"])),
  ...Object.fromEntries(RUNTIME_BUCKETS.map((t) => [t, "runtime_bucket"])),
  ...Object.fromEntries(REWATCH_VALUES.map((t) => [t, "rewatch_value"])),
  ...Object.fromEntries(PRESTIGE_VS_BLOCKBUSTER.map((t) => [t, "prestige_vs_blockbuster"])),
  ...Object.fromEntries(SHOW_FORMATS.map((t) => [t, "show_format"])),
  ...Object.fromEntries(ANTHOLOGY_VS_CONTINUOUS.map((t) => [t, "anthology_vs_continuous"])),
  ...Object.fromEntries(BINGE_VS_WEEKLY.map((t) => [t, "binge_vs_weekly"])),
  ...Object.fromEntries(EPISODE_COUNT_BUCKETS.map((t) => [t, "episode_count_bucket"])),
  ...Object.fromEntries(DEMOGRAPHICS.map((t) => [t, "demographic"])),
  ...Object.fromEntries(INDUSTRIES.map((t) => [t, "industry"])),
};
