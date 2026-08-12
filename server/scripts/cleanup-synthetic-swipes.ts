/**
 * Cleanup for the synthetic test data created by scripts/seed-synthetic-swipes.ts (see that
 * file's header for full context — this is the fake-user/fake-swipe dataset used to validate
 * the Learned Weight Tuning pipeline before real usage clears MIN_INTERACTIONS).
 *
 * Default (no flags): dry-run report only — counts synthetic users/interactions/quiz
 * responses, changes nothing. Safe to run any time to check whether synthetic data is still
 * present.
 *
 * --delete: actually removes every User with isSynthetic = true. Their UserTitleAction and
 * QuizResponse rows cascade-delete automatically (onDelete: Cascade on both relations in
 * schema.prisma) — deleting the Users is the whole operation.
 *
 * Note this is a belt-and-suspenders cleanup, not the only safeguard: runWeightTraining()
 * already excludes isSynthetic users from every production training run by default (see
 * src/lib/trainWeights.ts), so leaving this data in place does not silently bias live
 * weights. Run --delete once real usage volume makes the test data no longer useful, to keep
 * the users table honest.
 *
 * Run with: npx tsx scripts/cleanup-synthetic-swipes.ts [--delete]
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const shouldDelete = process.argv.includes("--delete");

  const syntheticUsers = await prisma.user.count({ where: { isSynthetic: true } });
  const syntheticInteractions = await prisma.userTitleAction.count({ where: { user: { isSynthetic: true } } });
  const syntheticQuizResponses = await prisma.quizResponse.count({ where: { user: { isSynthetic: true } } });

  console.log("=== SYNTHETIC TEST DATA REPORT ===");
  console.log(`Synthetic users:          ${syntheticUsers}`);
  console.log(`Synthetic interactions:   ${syntheticInteractions}`);
  console.log(`Synthetic quiz responses: ${syntheticQuizResponses}`);

  if (syntheticUsers === 0) {
    console.log("\nNothing to clean up.");
    return;
  }

  if (!shouldDelete) {
    console.log("\nDry run only — nothing deleted. Re-run with --delete to remove these rows.");
    return;
  }

  const result = await prisma.user.deleteMany({ where: { isSynthetic: true } });
  console.log(`\nDeleted ${result.count} synthetic users (cascade-deleted their interactions and quiz responses).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
