import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { getLatestTagProfile } from "../lib/userProfile";

export const profileRouter = Router();

profileRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const profile = await getLatestTagProfile(req.user!.userId, "onboarding");
  const topTags = profile
    ? Object.entries(profile.tagProfile)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, weight]) => ({ tag, weight }))
    : [];

  const quizHistory = await prisma.quizResponse.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, createdAt: true, watchedTitleId: true },
  });

  res.json({
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    topTags,
    hasCompletedOnboarding: !!profile,
    quizHistory,
  });
});
