/**
 * CLI entry point for the learned-weight training run — see src/lib/trainWeights.ts for the
 * actual logic (shared with the Vercel Cron endpoint, routes/cron.ts).
 *
 * Run with: npx tsx scripts/train-weights.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runWeightTraining } from "../src/lib/trainWeights";

async function main() {
  const result = await runWeightTraining();
  if (result.status === "skipped") {
    console.log(`[train-weights] Skipped: ${result.reason}`);
    return;
  }
  console.log(
    `[train-weights] Promoted new weights (trained on ${result.rowCount} rows, validation accuracy ${result.validationAccuracy.toFixed(3)}).`,
  );
  console.log(JSON.stringify(result.weights, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
