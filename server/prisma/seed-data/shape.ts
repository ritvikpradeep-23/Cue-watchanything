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
  /** original/audio language(s) — defaults to ["English"], or the anime default below, when omitted */
  language?: Language[];
  /** regional film/TV industry — defaults to ["Hollywood"], or the anime default below, when omitted */
  industry?: Industry[];
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

/** Default language/industry when a raw title doesn't specify one — anime defaults to
 * Japanese-language / Japanese Animation (plus English audio if dubbed), everything else
 * defaults to English/Hollywood. Exceptions (Korean, Indian, and other non-English titles)
 * are tagged explicitly per-entry in the batch files that introduce them. */
function defaultLanguage(r: RawTitle): Language[] {
  if (r.type === "anime") {
    return r.sub_dub?.includes("dub-available") ? ["Japanese", "English"] : ["Japanese"];
  }
  return ["English"];
}

function defaultIndustry(r: RawTitle): Industry[] {
  if (r.type === "anime") return ["Japanese Animation"];
  return ["Hollywood"];
}

/** Derived purely from runtime_minutes — never hand-tagged/guessed. Movies only; other types
 * have no runtime_minutes and get no bucket. */
function deriveRuntimeBucket(r: RawTitle): TitleSeed["tags"]["runtime_bucket"] {
  if (r.runtime == null) return [];
  if (r.runtime < 90) return ["short"];
  if (r.runtime <= 120) return ["standard"];
  if (r.runtime <= 150) return ["long"];
  return ["epic"];
}

/** Derived purely from episode count — never hand-tagged/guessed. Titles with no episode
 * count get no bucket. */
function deriveEpisodeCountBucket(r: RawTitle): TitleSeed["tags"]["episode_count_bucket"] {
  if (r.episodes == null) return [];
  if (r.episodes <= 13) return ["short"];
  if (r.episodes <= 30) return ["standard"];
  return ["long-runner"];
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
    languages: r.language ?? defaultLanguage(r),
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
      industry: r.industry ?? defaultIndustry(r),
      runtime_bucket: deriveRuntimeBucket(r),
      episode_count_bucket: deriveEpisodeCountBucket(r),
      // No reliable derivation from existing fields, and not hand-tagged across the catalog
      // yet — left empty rather than guessed (see quiz spec).
      rewatch_value: [],
      prestige_vs_blockbuster: [],
      show_format: [],
      anthology_vs_continuous: [],
      binge_vs_weekly: [],
      demographic: [],
    },
  };
}
