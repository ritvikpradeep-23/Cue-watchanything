import { compareProfiles } from "@watch-recommender/shared";
import { prisma } from "./prisma";
import { getLatestTagProfile } from "./userProfile";

/** Similarity score (0..1, see compareProfiles) at or above which two users can chat / start a
 * Watch Together session without being friends first. */
export const CHAT_SIMILARITY_THRESHOLD = 0.5;

export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return ids;
}

export async function isBlocked(userId: string, otherId: string): Promise<boolean> {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherId },
        { blockerId: otherId, blockedId: userId },
      ],
    },
  });
  return !!row;
}

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: userId },
      ],
    },
  });
  return !!row;
}

export async function getSimilarity(userId: string, otherId: string): Promise<number> {
  const [a, b] = await Promise.all([
    getLatestTagProfile(userId, "onboarding"),
    getLatestTagProfile(otherId, "onboarding"),
  ]);
  if (!a || !b) return 0;
  return compareProfiles(a.tagProfile, b.tagProfile);
}

/** The single eligibility check chat and Watch Together both gate on: not blocked either
 * direction, and either an accepted friendship or similarity crossing the threshold. */
export async function canInteract(userId: string, otherId: string): Promise<{ eligible: boolean; similarity: number }> {
  const [blocked, friends, similarity] = await Promise.all([
    isBlocked(userId, otherId),
    areFriends(userId, otherId),
    getSimilarity(userId, otherId),
  ]);
  if (blocked) return { eligible: false, similarity };
  return { eligible: friends || similarity >= CHAT_SIMILARITY_THRESHOLD, similarity };
}
