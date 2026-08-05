/**
 * Generates the retro/pop-art placeholder poster (SVG) for every seeded title.
 * No scraping, no external image APIs — see src/lib/posterArt.ts for the shared generator
 * also used at runtime by the admin add-title route.
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { TITLES } from "../prisma/seed-data/titles";
import { buildPosterSvg } from "../src/lib/posterArt";

const OUT_DIR = path.resolve(__dirname, "../../client/public/posters");

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const title of TITLES) {
  const svg = buildPosterSvg({
    id: title.id,
    name: title.name,
    type: title.type,
    year: title.release_year,
    primaryGenre: title.tags.genre[0],
  });
  writeFileSync(path.join(OUT_DIR, `${title.id}.svg`), svg, "utf-8");
  count++;
}

console.log(`Generated ${count} poster placeholders in ${OUT_DIR}`);
