import type {
  CastStyle,
  CompletionStatus,
  ContentRating,
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
  Recency,
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
