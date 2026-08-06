/**
 * Second TMDB-assisted import batch — same mechanism as import-tmdb-titles.ts, prioritizing
 * Malayalam cinema (zero titles before this batch), more Tamil/Telugu, Japanese movies, Korean
 * movies, and Korean TV/K-dramas, per the "still too English-heavy" follow-up request.
 *
 * Run with: npx tsx scripts/import-tmdb-titles-2.ts
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

const IMPORTS: ImportSpec[] = [
  // ---- Mollywood (Malayalam) — zero titles before this batch ----
  {
    id: "drishyam-2013", name: "Drishyam", tmdbType: "movie", ourType: "movie", year: 2013,
    platforms: ["Netflix"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["thriller", "drama", "mystery"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["franchise"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "premam", name: "Premam", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["romance", "comedy", "drama"], mood: ["feel-good", "funny-witty"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "kumbalangi-nights", name: "Kumbalangi Nights", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama"], mood: ["dark", "feel-good"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "the-great-indian-kitchen", name: "The Great Indian Kitchen", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "maheshinte-prathikaaram", name: "Maheshinte Prathikaaram", tmdbType: "movie", ourType: "movie", year: 2016,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["comedy", "drama"], mood: ["feel-good", "funny-witty"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["family"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "humor"],
  },
  {
    id: "lucifer-2019", name: "Lucifer", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Netflix"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["action", "drama", "thriller"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["franchise"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "jallikattu", name: "Jallikattu", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["thriller", "drama"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "plot-twists"],
  },
  {
    id: "ustad-hotel", name: "Ustad Hotel", tmdbType: "movie", ourType: "movie", year: 2012,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "comedy"], mood: ["feel-good"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["family"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "charlie-2015", name: "Charlie", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["romance", "drama", "fantasy"], mood: ["feel-good", "light"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "kammatipaadam", name: "Kammatipaadam", tmdbType: "movie", ourType: "movie", year: 2016,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "thriller", "action"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },

  // ---- more Tamil (Kollywood) ----
  {
    id: "vikram-vedha-2017", name: "Vikram Vedha", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "thriller", "drama"], mood: ["dark", "cerebral-ideas"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "pariyerum-perumal", name: "Pariyerum Perumal", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "aruvi", name: "Aruvi", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "karnan", name: "Karnan", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "action"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },

  // ---- more Telugu (Tollywood) ----
  {
    id: "baahubali-2", name: "Baahubali 2: The Conclusion", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Netflix"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["action", "fantasy", "drama"], mood: ["intense"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["graphic-violence"],
    era: ["fantasy-world"], structure: ["franchise"], recency: ["classic"], length: ["single-sitting"],
    love: ["world-building", "plot-twists"],
  },
  {
    id: "jersey-2019", name: "Jersey", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["drama"], mood: ["feel-good", "intense"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "mahanati", name: "Mahanati", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Prime Video"], language: ["Telugu"], industry: ["Tollywood"],
    genre: ["drama"], mood: ["dark", "feel-good"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },

  // ---- Japanese movies (live-action, expanding beyond batch 036) ----
  {
    id: "your-name-liveaction-note", name: "Perfect Blue", tmdbType: "movie", ourType: "movie", year: 1997,
    platforms: ["HBO Max"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["thriller", "horror", "mystery"], mood: ["dark", "cerebral-mystery"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "hana-bi", name: "Hana-bi", tmdbType: "movie", ourType: "movie", year: 1997,
    platforms: ["HBO Max"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama", "thriller"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "an-2015", name: "Sweet Bean", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Hulu"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama", "slice-of-life"], mood: ["feel-good", "dark"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["family"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "like-father-like-son", name: "Like Father, Like Son", tmdbType: "movie", ourType: "movie", year: 2013,
    platforms: ["Prime Video"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "confessions-2010", name: "Confessions", tmdbType: "movie", ourType: "movie", year: 2010,
    platforms: ["HBO Max"], language: ["Japanese"], industry: ["Japanese Cinema"],
    genre: ["thriller", "drama", "mystery"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },

  // ---- Korean movies (expanding beyond batch 036) ----
  {
    id: "a-tale-of-two-sisters", name: "A Tale of Two Sisters", tmdbType: "movie", ourType: "movie", year: 2003,
    platforms: ["Hulu"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["horror", "mystery", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "memories-of-murder", name: "Memories of Murder", tmdbType: "movie", ourType: "movie", year: 2003,
    platforms: ["HBO Max"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "mystery", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "the-wailing", name: "The Wailing", tmdbType: "movie", ourType: "movie", year: 2016,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["horror", "mystery", "thriller"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "plot-twists"],
  },
  {
    id: "i-saw-the-devil", name: "I Saw the Devil", tmdbType: "movie", ourType: "movie", year: 2010,
    platforms: ["Hulu"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "horror"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "a-taxi-driver", name: "A Taxi Driver", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["drama", "action"], mood: ["intense", "feel-good"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },

  // ---- Korean TV / K-dramas (expanding beyond batch 036) ----
  {
    id: "hospital-playlist", name: "Hospital Playlist", tmdbType: "tv", ourType: "show", year: 2020,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["drama", "comedy", "slice-of-life"], mood: ["feel-good", "funny-witty"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["episodic"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "itaewon-class", name: "Itaewon Class", tmdbType: "tv", ourType: "show", year: 2020,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["drama"], mood: ["intense", "feel-good"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["serialized"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "hometown-cha-cha-cha", name: "Hometown Cha-Cha-Cha", tmdbType: "tv", ourType: "show", year: 2021,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["romance", "comedy", "slice-of-life"], mood: ["feel-good", "light"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["family"],
    era: ["modern"], structure: ["episodic"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "signal-2016", name: "Signal", tmdbType: "tv", ourType: "show", year: 2016,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "mystery", "sci-fi"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["serialized"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "stranger-korean", name: "Stranger", tmdbType: "tv", ourType: "show", year: 2017,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["thriller", "mystery", "drama"], mood: ["dark", "cerebral-mystery"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["serialized"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "start-up-2020", name: "Start-Up", tmdbType: "tv", ourType: "show", year: 2020,
    platforms: ["Netflix"], language: ["Korean"], industry: ["Korean Cinema"],
    genre: ["romance", "drama"], mood: ["feel-good", "intense"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["episodic"], completion: ["completed"], recency: ["hidden-gem"], length: ["short-binge"],
    love: ["characters", "emotional-weight"],
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

/** Batch 037 — second multi-language pass: Malayalam/Mollywood (zero titles before this
 * batch), more Tamil/Kollywood and Telugu/Tollywood, Japanese movies (live-action), Korean
 * movies, and Korean TV/K-dramas. Plot/cast/year/runtime sourced from TMDB (see
 * scripts/import-tmdb-titles-2.ts); platforms and every taxonomy tag assigned by hand. */
export const RAW: RawTitle[] = [
${lines.join("\n")}
];
`;

  const outPath = path.resolve(__dirname, "../prisma/seed-data/batches/037-multilingual-expansion-2.ts");
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
