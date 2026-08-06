/**
 * One-shot importer: fetches plot/cast/year/seasons-episodes/original-language from TMDB for a
 * curated list of non-English titles (metadata only — platforms and our own taxonomy tags are
 * assigned by hand below, never pulled from TMDB), and writes the result out as a new batch
 * file under prisma/seed-data/batches/, same shape as every hand-authored batch.
 *
 * Run with: npx tsx scripts/import-tmdb-titles.ts
 * Titles TMDB can't resolve, or resolves with no overview/cast, are logged and left out
 * entirely rather than seeded with gaps (per the "flag incomplete, don't guess" requirement).
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import path from "path";
import { fetchTmdbMetadata } from "./lib/tmdb";

interface ImportSpec {
  id: string;
  name: string;
  tmdbType: "movie" | "tv";
  ourType: "movie" | "show";
  year: number;
  platforms: string[];
  language: string[];
  industry: string[];
  genre: string[];
  mood: string[];
  pace: string[];
  tone: string[];
  cast_style: string[];
  content_rating: string[];
  intensity?: string[];
  era: string[];
  structure: string[];
  completion?: string[];
  recency: string[];
  length: string[];
  love: string[];
}

// Hand-picked, real, well-known titles — chosen specifically to cover industries that were
// thin or absent (Kollywood/Tamil had zero titles before this batch). Tags below are assigned
// from genuine familiarity with each title, not inferred from TMDB.
const IMPORTS: ImportSpec[] = [
  // ---- Kollywood (Tamil) ----
  {
    id: "vikram-2022", name: "Vikram", tmdbType: "movie", ourType: "movie", year: 2022,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "thriller"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "soorarai-pottru", name: "Soorarai Pottru", tmdbType: "movie", ourType: "movie", year: 2020,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama"], mood: ["intense", "feel-good"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "asuran", name: "Asuran", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "thriller", "action"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "kaithi", name: "Kaithi", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "thriller"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "96", name: "96", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["romance", "drama"], mood: ["feel-good", "dark"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "super-deluxe", name: "Super Deluxe", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "comedy", "mystery"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "jai-bhim", name: "Jai Bhim", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "thriller"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "vada-chennai", name: "Vada Chennai", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["thriller", "drama", "action"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "plot-twists"],
  },

  // ---- Tollywood (Telugu) ----
  {
    id: "pushpa-the-rise", name: "Pushpa: The Rise", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["action", "drama"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "baahubali-beginning", name: "Baahubali: The Beginning", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Netflix"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["action", "fantasy", "drama"], mood: ["intense"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["graphic-violence"],
    era: ["fantasy-world"], structure: ["franchise"], recency: ["classic"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "arjun-reddy", name: "Arjun Reddy", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["romance", "drama"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "eega", name: "Eega", tmdbType: "movie", ourType: "movie", year: 2012,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["fantasy", "action", "comedy"], mood: ["light", "funny-silly"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["family"],
    era: ["fantasy-world"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["world-building", "humor"],
  },
  {
    id: "rangasthalam", name: "Rangasthalam", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["drama", "action"], mood: ["intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "sita-ramam", name: "Sita Ramam", tmdbType: "movie", ourType: "movie", year: 2022,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["romance", "drama"], mood: ["feel-good", "cerebral-mystery"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["family"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "plot-twists"],
  },

  // ---- Bollywood (Hindi) — rounding out beyond the existing batch ----
  {
    id: "gangs-of-wasseypur", name: "Gangs of Wasseypur", tmdbType: "movie", ourType: "movie", year: 2012,
    platforms: ["Prime Video"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["drama", "thriller", "action"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["historical"], structure: ["franchise"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "pink-2016", name: "Pink", tmdbType: "movie", ourType: "movie", year: 2016,
    platforms: ["Prime Video"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["drama", "thriller"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "talvar", name: "Talvar", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Prime Video"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["thriller", "mystery", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "masaan", name: "Masaan", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Prime Video"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["drama", "romance"], mood: ["dark", "feel-good"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "newton-2017", name: "Newton", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Netflix"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["comedy", "drama"], mood: ["cerebral-ideas", "funny-witty"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "humor"],
  },
  {
    id: "uri-surgical-strike", name: "Uri: The Surgical Strike", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Netflix"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["action", "drama"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "kahaani", name: "Kahaani", tmdbType: "movie", ourType: "movie", year: 2012,
    platforms: ["Prime Video"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["thriller", "mystery"], mood: ["cerebral-mystery", "dark"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "a-wednesday", name: "A Wednesday", tmdbType: "movie", ourType: "movie", year: 2008,
    platforms: ["Prime Video"], language: ["Hindi"], industry: ["Bollywood"],
    genre: ["thriller"], mood: ["intense", "cerebral-ideas"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },

  // ---- Korean ----
  {
    id: "oldboy-2003", name: "Oldboy", tmdbType: "movie", ourType: "movie", year: 2003,
    platforms: ["HBO Max"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "mystery", "action"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "burning-2018", name: "Burning", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "mystery", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "the-handmaiden", name: "The Handmaiden", tmdbType: "movie", ourType: "movie", year: 2016,
    platforms: ["Prime Video"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "romance", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "decision-to-leave", name: "Decision to Leave", tmdbType: "movie", ourType: "movie", year: 2022,
    platforms: ["Hulu"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "romance", "mystery"], mood: ["cerebral-mystery"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["plot-twists", "emotional-weight"],
  },
  {
    id: "mr-sunshine", name: "Mr. Sunshine", tmdbType: "tv", ourType: "show", year: 2018,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["romance", "drama", "action"], mood: ["intense", "feel-good"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["historical"], structure: ["episodic"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "reply-1988", name: "Reply 1988", tmdbType: "tv", ourType: "show", year: 2015,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["comedy", "drama", "slice-of-life"], mood: ["feel-good", "funny-witty"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["family"],
    era: ["historical"], structure: ["episodic"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "vincenzo", name: "Vincenzo", tmdbType: "tv", ourType: "show", year: 2021,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "comedy", "action"], mood: ["dark", "funny-witty"], pace: ["fast-paced"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["serialized"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "business-proposal", name: "Business Proposal", tmdbType: "tv", ourType: "show", year: 2022,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["romance", "comedy"], mood: ["light", "funny-witty"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["episodic"], completion: ["completed"], recency: ["new-buzzy"], length: ["short-binge"],
    love: ["humor", "characters"],
  },

  // ---- Japanese (live-action, non-anime) ----
  {
    id: "shoplifters", name: "Shoplifters", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Hulu"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "drive-my-car", name: "Drive My Car", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["HBO Max"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama"], mood: ["cerebral-ideas", "dark"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "seven-samurai", name: "Seven Samurai", tmdbType: "movie", ourType: "movie", year: 1954,
    platforms: ["HBO Max"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["action", "drama"], mood: ["intense"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["graphic-violence"],
    era: ["historical"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "ran-1985", name: "Ran", tmdbType: "movie", ourType: "movie", year: 1985,
    platforms: ["HBO Max"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama", "action"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["historical"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "departures-2008", name: "Departures", tmdbType: "movie", ourType: "movie", year: 2008,
    platforms: ["Prime Video"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama"], mood: ["feel-good", "dark"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "midnight-diner", name: "Midnight Diner: Tokyo Stories", tmdbType: "tv", ourType: "show", year: 2016,
    platforms: ["Netflix"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama", "slice-of-life"], mood: ["comfort-background", "feel-good"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["family"],
    era: ["modern"], structure: ["episodic"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "emotional-weight"],
  },

  // ---- Spanish-language (Spain + Latin America) ----
  {
    id: "pans-labyrinth", name: "Pan's Labyrinth", tmdbType: "movie", ourType: "movie", year: 2006,
    platforms: ["HBO Max"], language: ["Spanish"], industry: ["European Cinema"],
    genre: ["fantasy", "drama", "horror"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["world-building", "emotional-weight"],
  },
  {
    id: "roma-2018", name: "Roma", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Netflix"], language: ["Spanish"], industry: ["Latin American Cinema"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "world-building"],
  },
  {
    id: "the-platform", name: "The Platform", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Netflix"], language: ["Spanish"], industry: ["European Cinema"],
    genre: ["sci-fi", "horror", "thriller"], mood: ["dark", "cerebral-ideas"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["sci-fi-future"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "plot-twists"],
  },
  {
    id: "y-tu-mama-tambien", name: "Y Tu Mamá También", tmdbType: "movie", ourType: "movie", year: 2001,
    platforms: ["HBO Max"], language: ["Spanish"], industry: ["Latin American Cinema"],
    genre: ["drama", "romance"], mood: ["dark", "feel-good"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "amores-perros", name: "Amores Perros", tmdbType: "movie", ourType: "movie", year: 2000,
    platforms: ["HBO Max"], language: ["Spanish"], industry: ["Latin American Cinema"],
    genre: ["drama", "thriller"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "motorcycle-diaries", name: "The Motorcycle Diaries", tmdbType: "movie", ourType: "movie", year: 2004,
    platforms: ["Prime Video"], language: ["Spanish"], industry: ["Latin American Cinema"],
    genre: ["drama"], mood: ["feel-good", "cerebral-ideas"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["historical"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "who-killed-sara", name: "Who Killed Sara?", tmdbType: "tv", ourType: "show", year: 2021,
    platforms: ["Netflix"], language: ["Spanish"], industry: ["Latin American Cinema"],
    genre: ["thriller", "mystery", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["serialized"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["plot-twists", "characters"],
  },
];

async function main() {
  console.log(`Fetching TMDB metadata for ${IMPORTS.length} titles...`);
  const lines: string[] = [];
  const flagged: string[] = [];
  let resolved = 0;

  for (const [i, spec] of IMPORTS.entries()) {
    const meta = await fetchTmdbMetadata(spec.name, spec.tmdbType, spec.year);
    if (!meta || !meta.overview.trim() || meta.cast.length === 0) {
      flagged.push(`${spec.id} (${spec.name}) — ${!meta ? "no TMDB match" : !meta.overview.trim() ? "no overview" : "no cast"}`);
      console.log(`[${i + 1}/${IMPORTS.length}] ${spec.name} -> FLAGGED, skipped`);
      continue;
    }

    const plot = meta.overview.replace(/"/g, '\\"').replace(/\n/g, " ");
    const castLine = JSON.stringify(meta.cast.slice(0, 5));
    resolved++;

    lines.push(`  {
    id: "${spec.id}", name: "${spec.name}", type: "${spec.ourType}",
    plot: "${plot}",
    cast: ${castLine}, ${spec.ourType === "movie" ? `runtime: ${meta.runtimeMinutes ?? "undefined"}` : `seasons: ${meta.seasons ?? 1}, episodes: ${meta.episodes ?? 0}`}, year: ${meta.releaseYear},
    platforms: ${JSON.stringify(spec.platforms)}, language: ${JSON.stringify(spec.language)}, industry: ${JSON.stringify(spec.industry)},
    genre: ${JSON.stringify(spec.genre)}, mood: ${JSON.stringify(spec.mood)}, pace: ${JSON.stringify(spec.pace)},
    tone: ${JSON.stringify(spec.tone)}, cast_style: ${JSON.stringify(spec.cast_style)}, content_rating: ${JSON.stringify(spec.content_rating)},${spec.intensity ? ` intensity: ${JSON.stringify(spec.intensity)},` : ""}
    era: ${JSON.stringify(spec.era)}, structure: ${JSON.stringify(spec.structure)},${spec.completion ? ` completion: ${JSON.stringify(spec.completion)},` : ""} recency: ${JSON.stringify(spec.recency)},
    length: ${JSON.stringify(spec.length)}, love: ${JSON.stringify(spec.love)},
  },`);
    console.log(`[${i + 1}/${IMPORTS.length}] ${spec.name} -> OK`);
  }

  const fileContent = `import type { RawTitle } from "../shape";

/** Batch 036 — multi-language expansion: real breadth across Kollywood/Tamil (previously zero
 * titles), Tollywood/Telugu, Bollywood/Hindi, Korean, Japanese live-action, and Spanish-language
 * (Spain + Latin America). Plot/cast/year/runtime sourced from TMDB (see
 * scripts/import-tmdb-titles.ts); platforms and every taxonomy tag assigned by hand — TMDB has
 * neither. */
export const RAW: RawTitle[] = [
${lines.join("\n")}
];
`;

  const outPath = path.resolve(__dirname, "../prisma/seed-data/batches/036-multilingual-expansion.ts");
  writeFileSync(outPath, fileContent);

  console.log(`\nDone. ${resolved}/${IMPORTS.length} resolved and written to ${outPath}`);
  if (flagged.length > 0) {
    console.log(`\n${flagged.length} FLAGGED (incomplete TMDB data, left out):`);
    flagged.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
