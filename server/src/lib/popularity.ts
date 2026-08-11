import { prisma } from "./prisma";
import { getTrendingStats } from "./trending";

/** Single internal "how popular/well-received is this title" signal, reused for actor/director
 * top-hits ranking and known_for_styles tie-breaking — average rating where we have one,
 * falling back to the swipe like-ratio (scaled to the same 0-5 range) where we don't. */
export async function getPopularityScores(): Promise<Map<string, number>> {
  const [ratingAgg, trending] = await Promise.all([
    prisma.rating.groupBy({ by: ["titleId"], _avg: { rating: true } }),
    getTrendingStats(),
  ]);
  const scores = new Map<string, number>();
  for (const r of ratingAgg) {
    if (r._avg.rating != null) scores.set(r.titleId, r._avg.rating);
  }
  for (const [titleId, stat] of trending) {
    if (!scores.has(titleId)) scores.set(titleId, stat.likeRatio * 5);
  }
  return scores;
}
