/**
 * Learned weight tuning — re-derives per-category weights from real swipe data via logistic
 * regression (cue-ml-weight-tuning-spec-Main.md). The spec calls for a separate Python/Render
 * Cron Job environment with scikit-learn; this codebase has neither Render nor a Python
 * runtime anywhere in its stack (Vercel + Node/Express), so this is a from-scratch TS
 * implementation of the same algorithm instead of assuming infrastructure that doesn't exist
 * here — see logisticRegression.ts for that reasoning. Shared by the CLI script
 * (scripts/train-weights.ts) and the Vercel Cron endpoint (routes/cron.ts) so the actual
 * training logic exists in exactly one place.
 */
import {
  FEATURE_CATEGORIES,
  buildFeatureVector,
  derivePreferredTagPerCategory,
  type TitleTags,
} from "@watch-recommender/shared";
import { prisma } from "./prisma";
import { trainLogisticRegression, accuracy, type LogisticRegressionResult } from "./logisticRegression";

const MIN_INTERACTIONS = 500;
/** A previously-strong preference (|weight| > this) flipping sign entirely in one training
 * cycle is treated as a red flag (small/skewed batch artifact), not a real signal. */
const SIGN_FLIP_THRESHOLD = 0.5;
const VALIDATION_SPLIT = 0.2;

export type TrainWeightsResult =
  | { status: "skipped"; reason: string }
  | { status: "promoted"; rowCount: number; validationAccuracy: number; weights: Record<string, number> }
  | { status: "dry_run"; rowCount: number; validationAccuracy: number; weights: Record<string, number> };

function passesSanityCheck(
  newWeights: Record<string, number>,
  previousWeights: Record<string, number> | null,
  validationAccuracy: number,
): { ok: boolean; reason?: string } {
  if (validationAccuracy <= 0.5) {
    return { ok: false, reason: `validation accuracy ${validationAccuracy.toFixed(3)} is at or below chance` };
  }
  if (previousWeights) {
    for (const category of FEATURE_CATEGORIES) {
      const prev = previousWeights[category] ?? 0;
      const next = newWeights[category] ?? 0;
      const flippedSign = Math.sign(prev) !== 0 && Math.sign(prev) !== Math.sign(next);
      if (flippedSign && Math.abs(prev) > SIGN_FLIP_THRESHOLD) {
        return { ok: false, reason: `"${category}" flipped sign (${prev.toFixed(2)} -> ${next.toFixed(2)})` };
      }
    }
  }
  return { ok: true };
}

export async function runWeightTraining(options?: { includeSynthetic?: boolean; dryRun?: boolean }): Promise<TrainWeightsResult> {
  const interactions = await prisma.userTitleAction.findMany({
    where: {
      action: { in: ["pass", "like", "super_like"] },
      // Synthetic swipes (scripts/seed-synthetic-swipes.ts) exist only to validate this
      // pipeline before real usage clears MIN_INTERACTIONS — excluded by default so they can
      // never silently bias production weights. The CLI script passes includeSynthetic: true
      // explicitly to test against them; the Vercel Cron endpoint never does.
      ...(options?.includeSynthetic ? {} : { user: { isSynthetic: false } }),
    },
    select: { userId: true, action: true, title: true },
  });

  if (interactions.length < MIN_INTERACTIONS) {
    return { status: "skipped", reason: `not enough data yet (${interactions.length}/${MIN_INTERACTIONS})` };
  }

  // Fetch each involved user's latest onboarding profile once, not per-row.
  const userIds = [...new Set(interactions.map((i) => i.userId))];
  const profiles = await prisma.quizResponse.findMany({
    where: { userId: { in: userIds }, kind: "onboarding" },
    orderBy: { createdAt: "desc" },
  });
  const latestProfileByUser = new Map<string, { tagProfile: Record<string, number>; filters: any }>();
  for (const p of profiles) {
    if (latestProfileByUser.has(p.userId)) continue; // already have this user's latest (desc order)
    latestProfileByUser.set(p.userId, JSON.parse(p.resultingTagProfile));
  }

  const X: number[][] = [];
  const y: number[] = [];
  for (const interaction of interactions) {
    const profile = latestProfileByUser.get(interaction.userId);
    if (!profile) continue; // no onboarding profile for this user — nothing to build features from

    const preferredByCategory = derivePreferredTagPerCategory(profile.tagProfile);
    const avoidGenres: string[] = profile.filters?.avoidGenres ?? [];
    const userLanguages: string[] = profile.filters?.languages ?? [];
    const titleTags: TitleTags = JSON.parse(interaction.title.tags);
    const titleLanguages: string[] = JSON.parse(interaction.title.languages);

    X.push(buildFeatureVector({ preferredByCategory, avoidGenres, userLanguages, titleTags, titleLanguages }));
    y.push(interaction.action === "pass" ? 0 : 1); // like and super_like share the same positive label
  }

  if (X.length < MIN_INTERACTIONS) {
    return { status: "skipped", reason: `only ${X.length} interactions had a matching user profile` };
  }

  if (new Set(y).size < 2) {
    return { status: "skipped", reason: "only one class present (all likes or all passes)" };
  }

  // 80/20 held-out split, shuffled — this is a periodic batch job, not something requiring
  // reproducibility across runs, so a fixed-seed-free shuffle is fine.
  const indices = [...X.keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const splitAt = Math.floor(indices.length * (1 - VALIDATION_SPLIT));
  const trainIdx = indices.slice(0, splitAt);
  const valIdx = indices.slice(splitAt);

  const model: LogisticRegressionResult = trainLogisticRegression(
    trainIdx.map((i) => X[i]),
    trainIdx.map((i) => y[i]),
  );
  const validationAccuracy = accuracy(
    valIdx.map((i) => X[i]),
    valIdx.map((i) => y[i]),
    model,
  );

  const newWeights: Record<string, number> = {};
  FEATURE_CATEGORIES.forEach((category, i) => {
    newWeights[category] = model.coefficients[i];
  });

  const previousActive = await prisma.learnedWeights.findFirst({ where: { isActive: true } });
  const previousWeights: Record<string, number> | null = previousActive ? JSON.parse(previousActive.weights) : null;

  const sanity = passesSanityCheck(newWeights, previousWeights, validationAccuracy);
  if (!sanity.ok) {
    return { status: "skipped", reason: `failed sanity check: ${sanity.reason}` };
  }

  if (options?.dryRun) {
    // Computes and validates a real model but never touches is_active — for exercising the
    // pipeline (e.g. against scripts/seed-synthetic-swipes.ts) without changing what live
    // scoring actually uses.
    return { status: "dry_run", rowCount: X.length, validationAccuracy, weights: newWeights };
  }

  await prisma.$transaction([
    prisma.learnedWeights.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.learnedWeights.create({
      data: { weights: JSON.stringify(newWeights), trainingRowCount: X.length, isActive: true },
    }),
  ]);

  return { status: "promoted", rowCount: X.length, validationAccuracy, weights: newWeights };
}
