/**
 * Reports how the nightly-trained learned_weights have moved over time — for keeping an eye
 * on the Learned Weight Tuning pipeline (cue-ml-weight-tuning-spec-Main.md) day over day.
 * Read-only, no writes.
 *
 * Run with: npx tsx scripts/weight-trends.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.learnedWeights.findMany({ orderBy: { trainedAt: "asc" } });
  if (rows.length === 0) {
    console.log("No trained weights yet.");
    return;
  }

  console.log(`=== LEARNED WEIGHTS HISTORY (${rows.length} run${rows.length === 1 ? "" : "s"}) ===\n`);

  const parsed = rows.map((r) => ({
    trainedAt: r.trainedAt,
    rows: r.trainingRowCount,
    active: r.isActive,
    weights: JSON.parse(r.weights) as Record<string, number>,
  }));

  for (const r of parsed) {
    console.log(`${r.trainedAt.toISOString()}  rows=${r.rows}  ${r.active ? "[ACTIVE]" : ""}`);
  }

  const latest = parsed[parsed.length - 1];
  const previous = parsed.length > 1 ? parsed[parsed.length - 2] : null;

  console.log(`\n--- Latest run: ${latest.trainedAt.toISOString()} ---`);
  const categories = Object.keys(latest.weights).sort((a, b) => Math.abs(latest.weights[b]) - Math.abs(latest.weights[a]));
  for (const c of categories) {
    const cur = latest.weights[c];
    if (!previous) {
      console.log(`  ${c.padEnd(28)} ${cur.toFixed(3)}`);
      continue;
    }
    const prev = previous.weights[c] ?? 0;
    const delta = cur - prev;
    const flippedSign = Math.sign(prev) !== 0 && Math.sign(cur) !== 0 && Math.sign(prev) !== Math.sign(cur);
    const flag = flippedSign ? "  <-- SIGN FLIP" : "";
    console.log(`  ${c.padEnd(28)} ${cur.toFixed(3).padStart(8)}  (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(3)})${flag}`);
  }

  if (previous) {
    const rowGrowth = latest.rows - previous.rows;
    console.log(`\nTraining set grew by ${rowGrowth} rows since the previous run (${previous.rows} -> ${latest.rows}).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
