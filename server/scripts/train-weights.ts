/**
 * CLI entry point for the learned-weight training run — see src/lib/trainWeights.ts for the
 * actual logic (shared with the Vercel Cron endpoint, routes/cron.ts).
 *
 * Run with: npx tsx scripts/train-weights.ts
 * Add --include-synthetic to train against synthetic swipes too (see
 * scripts/seed-synthetic-swipes.ts) — for validating this pipeline only. Never used by the
 * Vercel Cron endpoint, which always excludes synthetic users.
 * Add --dry-run to compute + sanity-check a model WITHOUT writing to learned_weights or
 * flipping is_active — use this for --include-synthetic runs so pipeline validation can never
 * promote synthetic-influenced weights into what live scoring actually serves real users.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runWeightTraining } from "../src/lib/trainWeights";

async function main() {
  const includeSynthetic = process.argv.includes("--include-synthetic");
  const dryRun = process.argv.includes("--dry-run");
  if (includeSynthetic) {
    console.log("[train-weights] --include-synthetic passed: training against synthetic test data too.");
  }
  if (dryRun) {
    console.log("[train-weights] --dry-run passed: will not write to learned_weights or change live scoring.");
  } else if (includeSynthetic) {
    console.log(
      "[train-weights] WARNING: --include-synthetic without --dry-run WILL promote synthetic-influenced weights to is_active if it passes the sanity check, immediately changing live scoring for real users. Add --dry-run unless that's actually intended.",
    );
  }

  const result = await runWeightTraining({ includeSynthetic, dryRun });
  if (result.status === "skipped") {
    console.log(`[train-weights] Skipped: ${result.reason}`);
    return;
  }
  const verb = result.status === "dry_run" ? "Computed (not promoted — dry run)" : "Promoted";
  console.log(
    `[train-weights] ${verb} weights (trained on ${result.rowCount} rows, validation accuracy ${result.validationAccuracy.toFixed(3)}).`,
  );
  console.log(JSON.stringify(result.weights, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
