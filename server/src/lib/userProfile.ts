import type { TagProfile, HardFilters } from "@watch-recommender/shared";
import { INDUSTRIES } from "@watch-recommender/shared";
import { prisma } from "./prisma";

export interface StoredProfile {
  tagProfile: TagProfile;
  filters: HardFilters;
  quizResponseId: string;
}

export async function getLatestTagProfile(userId: string, kind: "onboarding" | "next_show" = "onboarding"): Promise<StoredProfile | null> {
  const row = await prisma.quizResponse.findFirst({
    where: { userId, kind },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  const parsed = JSON.parse(row.resultingTagProfile) as { tagProfile: TagProfile; filters: HardFilters };
  return { tagProfile: parsed.tagProfile, filters: parsed.filters, quizResponseId: row.id };
}

export async function getSwipedTitleIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.userTitleAction.findMany({
    where: { userId, action: { in: ["pass", "like", "super_like"] } },
    select: { titleId: true },
  });
  return new Set(rows.map((r) => r.titleId));
}

/** Comfort-zone toggle: biases the deck toward industry tags the user hasn't explored much
 * yet, rather than random noise — a boost delta on whichever industries appear least (or not
 * at all) among what they've already liked/watched, meant to be layered onto the stored
 * profile with applyDelta before calling buildDeck. */
export async function computeComfortZoneBoost(userId: string): Promise<TagProfile> {
  const actioned = await prisma.userTitleAction.findMany({
    where: { userId, action: { in: ["like", "super_like", "watched"] } },
    include: { title: true },
  });

  const counts = new Map<string, number>(INDUSTRIES.map((i) => [i, 0]));
  for (const a of actioned) {
    const tags = JSON.parse(a.title.tags) as { industry?: string[] };
    for (const industry of tags.industry ?? []) {
      counts.set(industry, (counts.get(industry) ?? 0) + 1);
    }
  }

  const maxCount = Math.max(0, ...counts.values());
  if (maxCount === 0) return {}; // no history yet — nothing to be "underrepresented" relative to

  const boost: TagProfile = {};
  for (const [industry, count] of counts) {
    if (count === 0) boost[industry] = 3;
  }
  return boost;
}
