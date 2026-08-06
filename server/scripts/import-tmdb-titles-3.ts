/**
 * Third TMDB-assisted import batch — priority expansion for Malayalam and Tamil, which were
 * the most underrepresented languages in the dataset (9 and 12 titles respectively before this
 * batch). Same mechanism as import-tmdb-titles(.ts|-2.ts).
 *
 * Run with: npx tsx scripts/import-tmdb-titles-3.ts
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
  // ---- Mollywood (Malayalam) ----
  {
    id: "bangalore-days", name: "Bangalore Days", tmdbType: "movie", ourType: "movie", year: 2014,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "romance", "comedy"], mood: ["feel-good", "light"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "angamaly-diaries", name: "Angamaly Diaries", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "action"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "thondimuthalum-driksakshiyum", name: "Thondimuthalum Driksakshiyum", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "comedy", "mystery"], mood: ["cerebral-ideas", "funny-witty"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "virus-2019", name: "Virus", tmdbType: "movie", ourType: "movie", year: 2019,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "thriller"], mood: ["intense", "cerebral-ideas"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "joji-2021", name: "Joji", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "thriller"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "minnal-murali", name: "Minnal Murali", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Netflix"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["action", "fantasy", "drama"], mood: ["feel-good", "intense"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "kurup-2021", name: "Kurup", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["thriller", "drama"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "bheeshma-parvam", name: "Bheeshma Parvam", tmdbType: "movie", ourType: "movie", year: 2022,
    platforms: ["Disney+ Hotstar"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "action"], mood: ["intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "manjummel-boys", name: "Manjummel Boys", tmdbType: "movie", ourType: "movie", year: 2024,
    platforms: ["Disney+ Hotstar"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "thriller"], mood: ["intense", "feel-good"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "2018-movie", name: "2018", tmdbType: "movie", ourType: "movie", year: 2023,
    platforms: ["Netflix"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "action"], mood: ["intense", "feel-good"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "aavesham", name: "Aavesham", tmdbType: "movie", ourType: "movie", year: 2024,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["comedy", "action"], mood: ["funny-witty", "intense"], pace: ["fast-paced"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["characters", "humor"],
  },
  {
    id: "bramayugam", name: "Bramayugam", tmdbType: "movie", ourType: "movie", year: 2024,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["horror", "drama", "fantasy"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["historical"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["world-building", "plot-twists"],
  },
  {
    id: "take-off-2017", name: "Take Off", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "thriller"], mood: ["intense", "feel-good"], pace: ["fast-paced"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "ayyappanum-koshiyum", name: "Ayyappanum Koshiyum", tmdbType: "movie", ourType: "movie", year: 2020,
    platforms: ["Disney+ Hotstar"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "action", "thriller"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "nayattu", name: "Nayattu", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Netflix"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["thriller", "drama"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "malik-2021", name: "Malik", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Malayalam"], industry: ["Mollywood"],
    genre: ["drama", "action"], mood: ["intense", "cerebral-ideas"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },

  // ---- Kollywood (Tamil) ----
  {
    id: "thani-oruvan", name: "Thani Oruvan", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "thriller"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "8-thottakkal", name: "8 Thottakkal", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["thriller", "action"], mood: ["intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "characters"],
  },
  {
    id: "ratsasan", name: "Ratsasan", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["thriller", "horror", "mystery"], mood: ["dark", "cerebral-mystery"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "sarpatta-parambarai", name: "Sarpatta Parambarai", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "action"], mood: ["intense", "feel-good"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["historical"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "visaranai", name: "Visaranai", tmdbType: "movie", ourType: "movie", year: 2015,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "thriller"], mood: ["dark", "intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence", "heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["classic"], length: ["single-sitting"],
    love: ["characters", "emotional-weight"],
  },
  {
    id: "maanagaram", name: "Maanagaram", tmdbType: "movie", ourType: "movie", year: 2017,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["thriller", "drama"], mood: ["dark", "intense"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["plot-twists", "world-building"],
  },
  {
    id: "mandela-2021", name: "Mandela", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["comedy", "drama"], mood: ["funny-witty", "feel-good"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["single-protagonist"], content_rating: ["family"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["humor", "characters"],
  },
  {
    id: "peranbu", name: "Peranbu", tmdbType: "movie", ourType: "movie", year: 2018,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama"], mood: ["dark", "cerebral-ideas"], pace: ["slow-burn"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["heavy-themes"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["emotional-weight", "characters"],
  },
  {
    id: "dharma-durai", name: "Dharma Durai", tmdbType: "movie", ourType: "movie", year: 2016,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "comedy"], mood: ["feel-good", "funny-witty"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["family"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "humor"],
  },
  {
    id: "oh-my-kadavule", name: "Oh My Kadavule", tmdbType: "movie", ourType: "movie", year: 2020,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["romance", "comedy", "drama"], mood: ["feel-good", "funny-witty"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["humor", "emotional-weight"],
  },
  {
    id: "master-2021", name: "Master", tmdbType: "movie", ourType: "movie", year: 2021,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "drama"], mood: ["intense", "funny-witty"], pace: ["fast-paced"], tone: ["mixed"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "beast-2022", name: "Beast", tmdbType: "movie", ourType: "movie", year: 2022,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "thriller"], mood: ["intense"], pace: ["fast-paced"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["characters", "plot-twists"],
  },
  {
    id: "ponniyin-selvan-1", name: "Ponniyin Selvan: I", tmdbType: "movie", ourType: "movie", year: 2022,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "action", "fantasy"], mood: ["intense"], pace: ["slow-burn"], tone: ["hopeful"],
    cast_style: ["ensemble"], content_rating: ["teen"], intensity: ["graphic-violence"],
    era: ["historical"], structure: ["franchise"], recency: ["hidden-gem"], length: ["single-sitting"],
    love: ["world-building", "characters"],
  },
  {
    id: "maamannan", name: "Maamannan", tmdbType: "movie", ourType: "movie", year: 2023,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["drama", "action"], mood: ["intense"], pace: ["slow-burn"], tone: ["gritty"],
    cast_style: ["ensemble"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["characters", "world-building"],
  },
  {
    id: "jailer-2023", name: "Jailer", tmdbType: "movie", ourType: "movie", year: 2023,
    platforms: ["Prime Video"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "comedy"], mood: ["intense", "funny-witty"], pace: ["fast-paced"], tone: ["mixed"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
    love: ["characters", "humor"],
  },
  {
    id: "leo-2023", name: "Leo", tmdbType: "movie", ourType: "movie", year: 2023,
    platforms: ["Netflix"], language: ["Tamil"], industry: ["Kollywood"],
    genre: ["action", "thriller"], mood: ["intense", "dark"], pace: ["fast-paced"], tone: ["gritty"],
    cast_style: ["single-protagonist"], content_rating: ["mature"], intensity: ["graphic-violence"],
    era: ["modern"], structure: ["standalone"], recency: ["new-buzzy"], length: ["single-sitting"],
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

/** Batch 038 — Malayalam/Tamil priority expansion (per-language minimum push): these two were
 * the most underrepresented languages in the dataset. Plot/cast/year/runtime sourced from TMDB
 * (see scripts/import-tmdb-titles-3.ts); platforms and every taxonomy tag assigned by hand. */
export const RAW: RawTitle[] = [
${lines.join("\n")}
];
`;

  const outPath = path.resolve(__dirname, "../prisma/seed-data/batches/038-malayalam-tamil-priority.ts");
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
