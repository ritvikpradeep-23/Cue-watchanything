import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitle, toApiTitleFromSeed, getAllTitleSeeds, getTitleSeedById } from "../lib/titles";
import { getTrendingStats } from "../lib/trending";
import { findSimilarTitles } from "@watch-recommender/shared";

export const titlesRouter = Router();

/** Full catalog, lightweight — used to build the dashboard's category carousels (no scoring/auth needed). */
titlesRouter.get("/", async (_req, res) => {
  const titles = await prisma.title.findMany({ orderBy: { name: "asc" } });
  const trending = await getTrendingStats();
  res.json({
    titles: titles.map((t) => ({
      ...toApiTitle(t),
      dateAdded: t.dateAdded,
      trending: trending.get(t.id) ?? null,
    })),
  });
});

async function ratingSummary(titleId: string) {
  const agg = await prisma.rating.aggregate({
    where: { titleId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return { average: agg._avg.rating, count: agg._count.rating };
}

titlesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const title = await prisma.title.findUnique({ where: { id } });
  if (!title) return res.status(404).json({ error: "Title not found" });
  const summary = await ratingSummary(title.id);
  res.json({ title: toApiTitle(title), rating: summary });
});

/** "More like this" / "Because you loved X" — reuses findSimilarTitles against the same
 * TitleSeed dataset the scoring engine already works from. */
titlesRouter.get("/:id/similar", async (req, res) => {
  const id = String(req.params.id);
  const target = await getTitleSeedById(id);
  if (!target) return res.status(404).json({ error: "Title not found" });

  const limit = Math.min(20, Number(req.query.limit) || 10);
  const similar = findSimilarTitles(target, await getAllTitleSeeds(), limit);
  res.json({ titles: similar.map(toApiTitleFromSeed) });
});

titlesRouter.get("/:id/ratings", async (req, res) => {
  const id = String(req.params.id);
  const ratings = await prisma.rating.findMany({
    where: { titleId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  res.json({
    ratings: ratings.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      displayName: r.user.email.split("@")[0],
    })),
  });
});

titlesRouter.post("/:id/ratings", requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { rating, comment } = req.body ?? {};
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return res.status(400).json({ error: "rating must be an integer 1-5" });
  }

  const title = await prisma.title.findUnique({ where: { id } });
  if (!title) return res.status(404).json({ error: "Title not found" });

  const saved = await prisma.rating.upsert({
    where: { userId_titleId: { userId: req.user!.userId, titleId: id } },
    create: { userId: req.user!.userId, titleId: id, rating: value, comment: comment || null },
    update: { rating: value, comment: comment || null },
  });

  res.status(201).json({ id: saved.id });
});
