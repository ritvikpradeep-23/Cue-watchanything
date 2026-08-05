import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";

export const watchlistRouter = Router();

watchlistRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const actions = await prisma.userTitleAction.findMany({
    where: { userId: req.user!.userId, action: { in: ["like", "super_like", "watched"] } },
    orderBy: { createdAt: "asc" },
    include: { title: true },
  });

  // last action per title wins (append-only log) — keep only titles currently liked/super_liked, not yet watched
  const latestByTitle = new Map<string, (typeof actions)[number]>();
  for (const a of actions) latestByTitle.set(a.titleId, a);

  const watchlistItems = [...latestByTitle.values()]
    .filter((a) => a.action === "like" || a.action === "super_like")
    .sort((a, b) => (a.action === b.action ? 0 : a.action === "super_like" ? -1 : 1));

  res.json({
    items: watchlistItems.map((a) => ({
      ...toApiTitle(a.title),
      superLiked: a.action === "super_like",
    })),
  });
});

watchlistRouter.post("/:titleId/watched", requireAuth, async (req: AuthedRequest, res) => {
  const titleId = String(req.params.titleId);
  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) return res.status(404).json({ error: "Title not found" });

  await prisma.userTitleAction.create({
    data: { userId: req.user!.userId, titleId, action: "watched" },
  });
  res.status(201).json({ ok: true });
});
