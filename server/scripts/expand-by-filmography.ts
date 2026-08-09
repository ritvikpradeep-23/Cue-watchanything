/**
 * Large-scale actor-filmography-driven dataset expansion (Phase 1).
 *
 * For each actor: TMDB search -> combined credits -> filter to 1990+, real credited roles ->
 * dedup against the existing dataset -> hard-skip unmapped languages -> hard-skip titles with
 * no verified flatrate platform match -> heuristic-tag from real TMDB fields -> write out as
 * RawTitle batch file(s).
 *
 * Run with: npx tsx scripts/expand-by-filmography.ts
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import path from "path";
import { TITLES } from "../prisma/seed-data/titles";
import { BATCH_TITLES } from "../prisma/seed-data/batches";
import {
  searchPerson,
  getCombinedCredits,
  getWatchProviders,
  getTitleDetails,
  getCertification,
  type CombinedCredit,
} from "./lib/tmdbFilmography";

// ---------------------------------------------------------------------------
// Phase 1 actor roster — sourced from real Wikipedia "top actors" / award-winner pages for the
// thinner industries (Tollywood, Japanese Cinema, European Cinema, Latin American Cinema), and
// well-established names for the already-larger industries. Actors already deeply covered in
// the dataset (Fahadh Faasil, Vijay Sethupathi, Dulquer Salmaan — 6-12 titles each already) are
// deliberately excluded in favor of lower-coverage names, per the "fill in underrepresented
// actors" goal.
// ---------------------------------------------------------------------------
interface ActorSpec {
  name: string;
  industry: string;
  regions: string[]; // watch-provider regions to check, in priority order
}

const REGIONS = {
  hollywood: ["US"],
  india: ["IN"],
  korea: ["KR", "US"],
  japan: ["JP", "US"],
  europe: ["GB", "DE", "FR"],
  latam: ["MX", "BR"],
};

const ACTORS: ActorSpec[] = [
  // Phase 2 — next slice of the 100-600 actor range, six new actors per industry (none
  // overlapping Phase 1's roster or the earlier hand-verified round's five actors).
  // Tollywood
  { name: "Jr NTR", industry: "Tollywood", regions: REGIONS.india },
  { name: "Ram Charan", industry: "Tollywood", regions: REGIONS.india },
  { name: "Nani", industry: "Tollywood", regions: REGIONS.india },
  { name: "Vijay Deverakonda", industry: "Tollywood", regions: REGIONS.india },
  { name: "Rana Daggubati", industry: "Tollywood", regions: REGIONS.india },
  { name: "Sai Dharam Tej", industry: "Tollywood", regions: REGIONS.india },
  // Kollywood
  { name: "Rajinikanth", industry: "Kollywood", regions: REGIONS.india },
  { name: "Kamal Haasan", industry: "Kollywood", regions: REGIONS.india },
  { name: "Sarath Kumar", industry: "Kollywood", regions: REGIONS.india },
  { name: "Jayam Ravi", industry: "Kollywood", regions: REGIONS.india },
  { name: "Arya", industry: "Kollywood", regions: REGIONS.india },
  { name: "Vishal", industry: "Kollywood", regions: REGIONS.india },
  // Mollywood
  { name: "Fahadh Faasil", industry: "Mollywood", regions: REGIONS.india },
  { name: "Dulquer Salmaan", industry: "Mollywood", regions: REGIONS.india },
  { name: "Biju Menon", industry: "Mollywood", regions: REGIONS.india },
  { name: "Suraj Venjaramoodu", industry: "Mollywood", regions: REGIONS.india },
  { name: "Indrajith Sukumaran", industry: "Mollywood", regions: REGIONS.india },
  { name: "Jayasurya", industry: "Mollywood", regions: REGIONS.india },
  // Bollywood
  { name: "Aamir Khan", industry: "Bollywood", regions: REGIONS.india },
  { name: "Ajay Devgn", industry: "Bollywood", regions: REGIONS.india },
  { name: "Ranbir Kapoor", industry: "Bollywood", regions: REGIONS.india },
  { name: "Varun Dhawan", industry: "Bollywood", regions: REGIONS.india },
  { name: "Sidharth Malhotra", industry: "Bollywood", regions: REGIONS.india },
  { name: "Vicky Kaushal", industry: "Bollywood", regions: REGIONS.india },
  // Korean Cinema
  { name: "Choi Min-sik", industry: "Korean Cinema", regions: REGIONS.korea },
  { name: "Hwang Jung-min", industry: "Korean Cinema", regions: REGIONS.korea },
  { name: "Kim Hye-soo", industry: "Korean Cinema", regions: REGIONS.korea },
  { name: "Jeon Do-yeon", industry: "Korean Cinema", regions: REGIONS.korea },
  { name: "Yoo Ah-in", industry: "Korean Cinema", regions: REGIONS.korea },
  { name: "Ryu Seung-ryong", industry: "Korean Cinema", regions: REGIONS.korea },
  // Japanese Cinema
  { name: "Ken Watanabe", industry: "Japanese Cinema", regions: REGIONS.japan },
  { name: "Koji Yakusho", industry: "Japanese Cinema", regions: REGIONS.japan },
  { name: "Masaharu Fukuyama", industry: "Japanese Cinema", regions: REGIONS.japan },
  { name: "Takeshi Kitano", industry: "Japanese Cinema", regions: REGIONS.japan },
  { name: "Yui Aragaki", industry: "Japanese Cinema", regions: REGIONS.japan },
  { name: "Satomi Ishihara", industry: "Japanese Cinema", regions: REGIONS.japan },
  // European Cinema
  { name: "Marion Cotillard", industry: "European Cinema", regions: REGIONS.europe },
  { name: "Vincent Cassel", industry: "European Cinema", regions: REGIONS.europe },
  { name: "Daniel Bruhl", industry: "European Cinema", regions: REGIONS.europe },
  { name: "Toni Servillo", industry: "European Cinema", regions: REGIONS.europe },
  { name: "Isabelle Huppert", industry: "European Cinema", regions: REGIONS.europe },
  { name: "Mads Mikkelsen", industry: "European Cinema", regions: REGIONS.europe },
  // Latin American Cinema
  { name: "Ana de la Reguera", industry: "Latin American Cinema", regions: REGIONS.latam },
  { name: "Kate del Castillo", industry: "Latin American Cinema", regions: REGIONS.latam },
  { name: "Eugenio Derbez", industry: "Latin American Cinema", regions: REGIONS.latam },
  { name: "Sonia Braga", industry: "Latin American Cinema", regions: REGIONS.latam },
  { name: "Wagner Moura", industry: "Latin American Cinema", regions: REGIONS.latam },
  { name: "Karla Souza", industry: "Latin American Cinema", regions: REGIONS.latam },
  // Hollywood
  { name: "Scarlett Johansson", industry: "Hollywood", regions: REGIONS.hollywood },
  { name: "Tom Hanks", industry: "Hollywood", regions: REGIONS.hollywood },
  { name: "Leonardo DiCaprio", industry: "Hollywood", regions: REGIONS.hollywood },
  { name: "Zendaya", industry: "Hollywood", regions: REGIONS.hollywood },
  { name: "Florence Pugh", industry: "Hollywood", regions: REGIONS.hollywood },
  { name: "Margot Robbie", industry: "Hollywood", regions: REGIONS.hollywood },
];

// ---------------------------------------------------------------------------
// Heuristic tagging — see plan doc for the full rule table. Every rule below ties to a real
// TMDB field (genre_ids, runtime/episodes, release date, cast billing order, belongs_to_collection,
// status, certification) rather than being invented per-title.
// ---------------------------------------------------------------------------

const GENRE_NAMES: Record<number, string> = {
  28: "action", 12: "action", 16: "animation", 35: "comedy", 80: "thriller", 99: "documentary",
  18: "drama", 10751: "family", 14: "fantasy", 36: "history", 27: "horror", 10402: "drama",
  9648: "mystery", 10749: "romance", 878: "sci-fi", 10770: "drama", 53: "thriller", 10752: "action",
  37: "action", 10759: "action", 10762: "family", 10765: "sci-fi", 10768: "drama",
};
const NON_FICTION_TV_GENRES = new Set([10763, 10764, 10766, 10767]);

const LANGUAGE_MAP: Record<string, string> = {
  en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil", ml: "Malayalam",
  ko: "Korean", ja: "Japanese", es: "Spanish", de: "German", fr: "French",
};

const LATAM_COUNTRIES = new Set(["MX", "AR", "CL", "CO", "PE", "BR", "VE", "UY", "EC", "BO"]);

function today() {
  return new Date();
}

function deriveGenres(genreIds: number[]): string[] {
  const set = new Set<string>();
  for (const id of genreIds) {
    const g = GENRE_NAMES[id];
    if (g && g !== "animation" && g !== "family") set.add(g);
  }
  return set.size > 0 ? [...set] : ["drama"];
}

function deriveMoodTone(genres: string[]): { mood: string[]; tone: string[] } {
  const has = (g: string) => genres.includes(g);
  if (has("horror")) return { mood: ["dark"], tone: ["gritty"] };
  if (has("thriller") || has("mystery")) return { mood: ["dark", "cerebral-mystery"], tone: ["gritty"] };
  if (has("action") && has("comedy")) return { mood: ["intense", "funny-witty"], tone: ["mixed"] };
  if (has("action")) return { mood: ["intense"], tone: ["gritty"] };
  if (has("comedy") && has("drama")) return { mood: ["funny-witty", "feel-good"], tone: ["mixed"] };
  if (has("comedy")) return { mood: ["funny-witty"], tone: ["hopeful"] };
  if (has("romance")) return { mood: ["feel-good"], tone: ["hopeful"] };
  if (has("sci-fi") || has("fantasy")) return { mood: ["cerebral-ideas"], tone: ["mixed"] };
  if (has("documentary")) return { mood: ["cerebral-ideas"], tone: ["mixed"] };
  return { mood: ["intense"], tone: ["mixed"] };
}

function derivePace(genres: string[]): string[] {
  return genres.some((g) => ["action", "thriller", "horror"].includes(g)) ? ["fast-paced"] : ["slow-burn"];
}

function deriveEra(genreIds: number[]): string[] {
  if (genreIds.includes(36)) return ["historical"];
  if (genreIds.includes(878) || genreIds.includes(10765)) return ["sci-fi-future"];
  if (genreIds.includes(14)) return ["fantasy-world"];
  return ["modern"];
}

function deriveLoveFactor(genres: string[]): string[] {
  const out = new Set<string>();
  if (genres.includes("mystery") || genres.includes("thriller")) out.add("plot-twists");
  if (genres.includes("sci-fi") || genres.includes("fantasy")) out.add("world-building");
  if (genres.includes("comedy")) out.add("humor");
  if (genres.includes("drama") || genres.includes("romance")) out.add("emotional-weight");
  if (out.size === 0) out.add("characters");
  if (out.size === 1) out.add("characters");
  return [...out].slice(0, 2);
}

function deriveRecency(releaseYear: number): string[] {
  const yearsAgo = today().getFullYear() - releaseYear;
  if (yearsAgo < 2) return ["new-buzzy"];
  if (yearsAgo <= 8) return ["hidden-gem"];
  return ["classic"];
}

function deriveContentRatingFallback(genres: string[]): string {
  if (genres.some((g) => ["horror"].includes(g))) return "mature";
  return "teen";
}

function mapCertification(cert: string, region: string): string | null {
  const c = cert.toUpperCase();
  if (region === "US") {
    if (["G", "PG", "TV-Y", "TV-G", "TV-PG"].includes(c)) return "family";
    if (["PG-13", "TV-14"].includes(c)) return "teen";
    if (["R", "NC-17", "TV-MA"].includes(c)) return "mature";
  }
  if (region === "IN") {
    if (c === "U") return "family";
    if (c === "U/A" || c === "UA") return "teen";
    if (c === "A") return "mature";
  }
  return null;
}

function deriveIndustryLanguage(
  originalLanguage: string,
  productionCountries: string[],
  isAnimation: boolean,
): { language: string; industry: string } | null {
  const language = LANGUAGE_MAP[originalLanguage];
  if (!language) return null;
  if (originalLanguage === "en") return { language, industry: "Hollywood" };
  if (originalLanguage === "hi") return { language, industry: "Bollywood" };
  if (originalLanguage === "te") return { language, industry: "Tollywood" };
  if (originalLanguage === "ta") return { language, industry: "Kollywood" };
  if (originalLanguage === "ml") return { language, industry: "Mollywood" };
  if (originalLanguage === "ko") return { language, industry: "Korean Cinema" };
  if (originalLanguage === "ja") return { language, industry: isAnimation ? "Japanese Animation" : "Japanese Cinema" };
  if (originalLanguage === "es") {
    const latam = productionCountries.some((c) => LATAM_COUNTRIES.has(c));
    return { language, industry: latam ? "Latin American Cinema" : "European Cinema" };
  }
  return { language, industry: "European Cinema" }; // de, fr
}

function slugify(name: string, year: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${year}`;
}

function normalizeTitle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const existing = new Set([...TITLES, ...BATCH_TITLES].map((t) => `${normalizeTitle(t.name)}|${t.release_year}`));
  const seenThisRun = new Set<string>();

  const outputLines: string[] = [];
  const skipReasons = { dedup: 0, oldRelease: 0, lowBilling: 0, nonFiction: 0, unmappedLanguage: 0, noPlatform: 0, noDetails: 0 };
  let actorsProcessed = 0;
  let titlesAdded = 0;
  const perActorCount: Record<string, number> = {};

  for (const actor of ACTORS) {
    const person = await searchPerson(actor.name);
    await sleep(300);
    if (!person) {
      console.log(`[actor] ${actor.name} -> NOT FOUND on TMDB, skipping`);
      continue;
    }

    const credits = await getCombinedCredits(person.id);
    await sleep(300);
    actorsProcessed++;
    perActorCount[actor.name] = 0;

    const candidates = credits.filter((c: CombinedCredit) => {
      if (!c.releaseDate) return false;
      const year = Number(c.releaseDate.slice(0, 4));
      if (!year || year < 1990 || year > today().getFullYear()) return false;
      if (c.order >= 8) return false;
      if (c.mediaType === "tv" && c.genreIds.some((g) => NON_FICTION_TV_GENRES.has(g))) return false;
      const key = `${normalizeTitle(c.title)}|${year}`;
      if (existing.has(key) || seenThisRun.has(key)) return false;
      return true;
    });

    console.log(`[actor] ${actor.name} (${actor.industry}) -> ${credits.length} credits, ${candidates.length} candidates after filtering`);

    for (const cand of candidates) {
      const year = Number(cand.releaseDate!.slice(0, 4));
      const key = `${normalizeTitle(cand.title)}|${year}`;

      const platforms = await getWatchProviders(cand.id, cand.mediaType, actor.regions);
      await sleep(300);
      if (platforms.length === 0) {
        skipReasons.noPlatform++;
        continue;
      }

      const isAnimationGenre = cand.genreIds.includes(16);
      const idLang = deriveIndustryLanguage(cand.originalLanguage, [], isAnimationGenre);
      if (!idLang) {
        skipReasons.unmappedLanguage++;
        continue;
      }

      const details = await getTitleDetails(cand.id, cand.mediaType);
      await sleep(300);
      if (!details || !details.overview.trim() || details.cast.length === 0) {
        skipReasons.noDetails++;
        continue;
      }

      // re-derive industry now that we have real production_countries for es-language disambiguation
      const finalIdLang = deriveIndustryLanguage(cand.originalLanguage, details.productionCountries, isAnimationGenre) ?? idLang;

      const region = actor.regions[0];
      const cert = await getCertification(cand.id, cand.mediaType, region);
      await sleep(300);

      const genres = deriveGenres(cand.genreIds);
      const { mood, tone } = deriveMoodTone(genres);
      const pace = derivePace(genres);
      const era = deriveEra(cand.genreIds);
      const love = deriveLoveFactor(genres);
      const recency = deriveRecency(year);
      const castStyle = cand.order <= 1 ? "single-protagonist" : "ensemble";
      const contentRating = (cert && mapCertification(cert, region)) || deriveContentRatingFallback(genres);
      const intensity =
        contentRating === "mature" && (genres.includes("horror") || genres.includes("action") || genres.includes("thriller"))
          ? ["graphic-violence"]
          : [];

      const isMovie = cand.mediaType === "movie";
      const type = isAnimationGenre && cand.originalLanguage === "ja" ? "anime" : isMovie ? "movie" : "show";
      const structure = isMovie ? (details.belongsToCollection ? "franchise" : "standalone") : "serialized";
      const completion = !isMovie ? [details.status === "Ended" || details.status === "Canceled" ? "completed" : "ongoing"] : undefined;
      const episodes = details.episodes ?? undefined;
      const length = isMovie
        ? "single-sitting"
        : !episodes
          ? "multi-season"
          : episodes <= 13
            ? "short-binge"
            : episodes <= 49
              ? "multi-season"
              : "long-runner";

      const id = slugify(cand.title, year);
      const plot = details.overview
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r\n|\r|\n/g, " ")
        .trim();
      const castLine = JSON.stringify(details.cast);

      outputLines.push(`  {
    id: "${id}", name: ${JSON.stringify(cand.title)}, type: "${type}",
    plot: "${plot}",
    cast: ${castLine}, ${isMovie ? `runtime: ${details.runtimeMinutes ?? "undefined"}` : `seasons: ${details.seasons ?? 1}, episodes: ${episodes ?? "undefined"}`}, year: ${year},
    platforms: ${JSON.stringify(platforms)}, language: ${JSON.stringify([finalIdLang.language])}, industry: ${JSON.stringify([finalIdLang.industry])},
    genre: ${JSON.stringify(genres)}, mood: ${JSON.stringify(mood)}, pace: ${JSON.stringify(pace)},
    tone: ${JSON.stringify(tone)}, cast_style: ${JSON.stringify([castStyle])}, content_rating: ${JSON.stringify([contentRating])},${intensity.length ? ` intensity: ${JSON.stringify(intensity)},` : ""}
    era: ${JSON.stringify(era)}, structure: ${JSON.stringify([structure])},${completion ? ` completion: ${JSON.stringify(completion)},` : ""} recency: ${JSON.stringify(recency)},
    length: ${JSON.stringify([length])}, love: ${JSON.stringify(love)},
  },`);

      seenThisRun.add(key);
      titlesAdded++;
      perActorCount[actor.name]++;
      console.log(`  [title] ${cand.title} (${year}) -> ${platforms.join(", ")} [${finalIdLang.industry}]`);
    }

    console.log(`[progress] actors processed: ${actorsProcessed}/${ACTORS.length}, titles added so far: ${titlesAdded}`);
  }

  console.log("\n=== Per-actor title counts ===");
  for (const [name, count] of Object.entries(perActorCount)) console.log(`  ${name}: ${count}`);
  console.log("\n=== Skip reasons ===");
  console.log(skipReasons);
  console.log(`\nTotal: ${actorsProcessed} actors processed, ${titlesAdded} titles added.`);

  const fileContent = `import type { RawTitle } from "../shape";

/** Batch 042 — large-scale actor-filmography expansion, Phase 2: ${ACTORS.length} actors across
 * all 9 industries, six new actors per industry (no overlap with Phase 1's 53 or the earlier
 * hand-verified round's 5). Generated by scripts/expand-by-filmography.ts —
 * plot/cast/runtime/episodes/collection/status from TMDB; platforms verified via TMDB
 * watch/providers (flatrate only, per-industry region, see script for region mapping) — never
 * guessed; qualitative tags (mood/tone/pace/cast_style/era/love_factor/content_rating fallback)
 * are TMDB-genre-driven heuristics, not hand-curated — see the script's documented rule table
 * for the exact logic. */
export const RAW: RawTitle[] = [
${outputLines.join("\n")}
];
`;

  const outPath = path.resolve(__dirname, "../prisma/seed-data/batches/042-actor-filmography-expansion-phase2.ts");
  writeFileSync(outPath, fileContent);
  console.log(`\nWritten to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
