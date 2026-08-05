import type { TagProfile, HardFilters } from "@watch-recommender/shared";
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
