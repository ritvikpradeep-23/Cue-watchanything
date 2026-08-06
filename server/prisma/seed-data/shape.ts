import type {
  CastStyle,
  CompletionStatus,
  ContentRating,
  EraSetting,
  Genre,
  Intensity,
  LengthBucket,
  LoveFactor,
  Mood,
  Pace,
  Platform,
  Recency,
  Structure,
  SubDub,
  TitleSeed,
  TitleType,
  Tone,
} from "@watch-recommender/shared";

/**
 * Compact authoring shape for hand-curated titles — expanded into a full TitleSeed by build().
 * Shared by the core seed (titles.ts) and every batch file under seed-data/batches/, so both
 * author against the exact same shape and taxonomy.
 */
export interface RawTitle {
  id: string;
  name: string;
  type: TitleType;
  plot: string;
  cast: string[];
  seasons?: number;
  episodes?: number;
  runtime?: number;
  year: number;
  platforms: Platform[];
  genre: Genre[];
  mood: Mood[];
  pace: Pace[];
  tone: Tone[];
  cast_style: CastStyle[];
  content_rating: ContentRating[];
  intensity?: Intensity[];
  era: EraSetting[];
  structure: Structure[];
  sub_dub?: SubDub[];
  completion?: CompletionStatus[];
  recency: Recency[];
  length: LengthBucket[];
  love: LoveFactor[];
}

export function build(r: RawTitle): TitleSeed {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    plot_summary: r.plot,
    cast: r.cast,
    seasons: r.seasons ?? null,
    episodes: r.episodes ?? null,
    runtime_minutes: r.runtime ?? null,
    release_year: r.year,
    platforms: r.platforms,
    poster_url: `/posters/${r.id}.svg`,
    tags: {
      genre: r.genre,
      mood: r.mood,
      pace: r.pace,
      tone: r.tone,
      cast_style: r.cast_style,
      content_rating: r.content_rating,
      intensity: r.intensity ?? [],
      era_setting: r.era,
      structure: r.structure,
      sub_dub: r.sub_dub ?? [],
      completion_status: r.completion ?? [],
      recency: r.recency,
      length_bucket: r.length,
      love_factor: r.love,
    },
  };
}
