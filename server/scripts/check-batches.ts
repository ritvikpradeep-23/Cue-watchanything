/**
 * Sanity checks for the growable dataset, run before every fetch-posters/seed-batches pass:
 *   1. Duplicate ids across the core seed + all batches.
 *   2. id/name mismatches — catches leftover/garbled ids copy-pasted from a previous entry
 *      while editing (a real, recurring failure mode during batch authoring), by requiring at
 *      least one significant word shared between the id and the slugified name. Heuristic, so
 *      false positives happen on short titles (single stopword-only names) — read the flagged
 *      list, don't blindly "fix" every hit.
 */
import { TITLES } from "../prisma/seed-data/titles";
import { BATCH_TITLES } from "../prisma/seed-data/batches";

const ALL = [...TITLES, ...BATCH_TITLES];

const seen = new Map<string, number>();
for (const t of ALL) seen.set(t.id, (seen.get(t.id) ?? 0) + 1);
const dupes = [...seen.entries()].filter(([, c]) => c > 1);

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "in", "on", "to", "is", "it"]);
function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}
const mismatches = ALL.filter((t) => {
  const idWords = new Set(t.id.split("-").filter((w) => w.length > 1 && !STOPWORDS.has(w)));
  return !words(t.name).some((w) => idWords.has(w));
});

console.log(`total titles: ${ALL.length} (core: ${TITLES.length}, batches: ${BATCH_TITLES.length})`);
console.log(`duplicate ids: ${dupes.length ? JSON.stringify(dupes) : "none"}`);
console.log(
  `id/name mismatches (${mismatches.length}): ${
    mismatches.length ? mismatches.map((t) => `id="${t.id}" name="${t.name}"`).join("; ") : "none"
  }`,
);
