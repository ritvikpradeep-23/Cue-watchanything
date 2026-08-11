import { prisma } from "./prisma";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { weights: Record<string, number> | null; expiresAt: number } | null = null;

/** The only thing the live web service does with the learned-weight model — one cached DB
 * read, no model inference at request time. Weights only change once a day at most (the
 * training script), so a 5-minute in-memory cache keeps this off the hot path almost entirely.
 * Returns null (not a fallback object) when there's no active row yet — buildDeck/scoreTitle
 * already treat an absent learnedWeights arg as "hand-coded weights only", which IS the
 * correct fallback, so there's no separate FALLBACK_HANDCODED_WEIGHTS constant to maintain
 * here (the existing WEIGHT constants in onboarding.ts already are that fallback). */
export async function getActiveWeights(): Promise<Record<string, number> | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.weights;

  const row = await prisma.learnedWeights.findFirst({ where: { isActive: true }, orderBy: { trainedAt: "desc" } });
  const weights = row ? (JSON.parse(row.weights) as Record<string, number>) : null;
  cached = { weights, expiresAt: Date.now() + CACHE_TTL_MS };
  return weights;
}

/** Test-only escape hatch — production code never needs to bypass the cache. */
export function _resetWeightsCacheForTests() {
  cached = null;
}
