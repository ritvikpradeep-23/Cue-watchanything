import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";

export const titlesRouter = Router();

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
