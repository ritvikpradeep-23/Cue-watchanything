import type {
  AnthologyVsContinuous,
  BingeVsWeekly,
  CastStyle,
  CompletionStatus,
  ContentRating,
  Demographic,
  EpisodeCountBucket,
  EraSetting,
  Genre,
  Industry,
  Intensity,
  Language,
  LengthBucket,
  LoveFactor,
  Mood,
  Pace,
  Platform,
  PrestigeVsBlockbuster,
  Recency,
  RewatchValue,
  RuntimeBucket,
  ShowFormat,
  Structure,
  SubDub,
  Tone,
  TitleType,
} from "./taxonomy";

/** The full tag set attached to a title in the dataset. Arrays, since a title can carry more than one value per category. */
export interface TitleTags {
  genre: Genre[];
  mood: Mood[];
  pace: Pace[];
  tone: Tone[];
  cast_style: CastStyle[];
  content_rating: ContentRating[];
  intensity: Intensity[];
  era_setting: EraSetting[];
  structure: Structure[];
  sub_dub: SubDub[];
  completion_status: CompletionStatus[];
  recency: Recency[];
  length_bucket: LengthBucket[];
  love_factor: LoveFactor[];
  /** regional film/TV industry — soft weighted preference, same pattern as genre */
  industry: Industry[];
  /** Derived purely from runtime_minutes at seed-build time (movies) — always populated, never
   * hand-curated/guessed. */
  runtime_bucket?: RuntimeBucket[];
  /** Derived purely from episodes at seed-build time (anime) — always populated, never
   * hand-curated/guessed. */
  episode_count_bucket?: EpisodeCountBucket[];
  // The six below have no reliable derivation from existing fields and haven't been
  // hand-tagged across the catalog yet — optional/untagged for now (contributes 0 to scoring
  // until a real tagging pass backfills them), rather than fabricated. See quiz spec.
  rewatch_value?: RewatchValue[];
  prestige_vs_blockbuster?: PrestigeVsBlockbuster[];
  show_format?: ShowFormat[];
  anthology_vs_continuous?: AnthologyVsContinuous[];
  binge_vs_weekly?: BingeVsWeekly[];
  demographic?: Demographic[];
}

export interface TitleSeed {
  id: string;
  name: string;
  type: TitleType;
  plot_summary: string;
  cast: string[];
  seasons: number | null;
  episodes: number | null;
  runtime_minutes: number | null;
  release_year: number;
  platforms: Platform[];
  /** original/audio language(s) available — HARD FILTER (see buildDeck), never weighted */
  languages: Language[];
  poster_url: string;
  tags: TitleTags;
}

/** user tag-profile: tag string -> accumulated weight */
export type TagProfile = Record<string, number>;

export type SwipeAction = "pass" | "like" | "super_like" | "watched";
