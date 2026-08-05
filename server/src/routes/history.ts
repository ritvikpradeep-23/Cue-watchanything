import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";

export const historyRouter = Router();

historyRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const watchedActions = await prisma.userTitleAction.findMany({
    where: { userId: req.user!.userId, action: "watched" },
    orderBy: { createdAt: "desc" },
    include: { title: true },
  });

  const seen = new Set<string>();
  const uniqueWatched = watchedActions.filter((a) => {
    if (seen.has(a.titleId)) return false;
    seen.add(a.titleId);
    return true;
  });

  const ratings = await prisma.rating.findMany({
    where: { userId: req.user!.userId, titleId: { in: uniqueWatched.map((a) => a.titleId) } },
  });
  const ratingByTitle = new Map(ratings.map((r) => [r.titleId, r]));

  res.json({
    items: uniqueWatched.map((a) => ({
      ...toApiTitle(a.title),
      watchedAt: a.createdAt,
      myRating: ratingByTitle.get(a.titleId)?.rating ?? null,
      myComment: ratingByTitle.get(a.titleId)?.comment ?? null,
    })),
  });
});
