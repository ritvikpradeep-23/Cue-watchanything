import { TITLES } from "../prisma/seed-data/titles";
import { BATCH_TITLES } from "../prisma/seed-data/batches";

const ALL = [...TITLES, ...BATCH_TITLES];

const counts = new Map<string, { count: number; industries: Set<string> }>();
for (const t of ALL) {
  for (const actor of t.cast) {
    const entry = counts.get(actor) ?? { count: 0, industries: new Set() };
    entry.count++;
    for (const ind of t.tags.industry) entry.industries.add(ind);
    counts.set(actor, entry);
  }
}

const industryArg = process.argv[2];
const rows = [...counts.entries()]
  .filter(([, v]) => !industryArg || v.industries.has(industryArg))
  .sort((a, b) => a[1].count - b[1].count || a[0].localeCompare(b[0]));

console.log(`Total unique actors: ${counts.size}, total titles: ${ALL.length}`);
if (industryArg) console.log(`Filtered to industry: ${industryArg}`);
console.log("actor | count | industries");
for (const [actor, v] of rows) {
  console.log(`${actor} | ${v.count} | ${[...v.industries].join(",")}`);
}
