import { prisma } from "./prisma";

/** Below this many like/pass-family actions on a title, we don't have enough signal to show a
 * trending stat — showing a ratio off 2 data points would be misleading, not helpful. */
const MIN_SAMPLE_SIZE = 8;

export interface TrendingStat {
  /** fraction of relevant swipes (like + super_like + pass) that were like or super_like */
  likeRatio: number;
  sampleSize: number;
}

/** Computed entirely from UserTitleAction rows already being recorded — no external trending
 * API involved. A title counts as "trending" once enough users have swiped on it that the
 * like-ratio actually means something. */
export async function getTrendingStats(): Promise<Map<string, TrendingStat>> {
  const grouped = await prisma.userTitleAction.groupBy({
    by: ["titleId", "action"],
    where: { action: { in: ["like", "super_like", "pass"] } },
    _count: { _all: true },
  });

  const perTitle = new Map<string, { like: number; super_like: number; pass: number }>();
  for (const row of grouped) {
    const entry = perTitle.get(row.titleId) ?? { like: 0, super_like: 0, pass: 0 };
    entry[row.action as "like" | "super_like" | "pass"] = row._count._all;
    perTitle.set(row.titleId, entry);
  }

  const stats = new Map<string, TrendingStat>();
  for (const [titleId, counts] of perTitle) {
    const sampleSize = counts.like + counts.super_like + counts.pass;
    if (sampleSize < MIN_SAMPLE_SIZE) continue;
    stats.set(titleId, {
      likeRatio: (counts.like + counts.super_like) / sampleSize,
      sampleSize,
    });
  }
  return stats;
}
