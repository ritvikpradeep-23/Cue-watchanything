import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";

export const actionsRouter = Router();

const VALID_ACTIONS = new Set(["pass", "like", "super_like", "watched"]);

actionsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const { titleId, action } = req.body ?? {};
  if (typeof titleId !== "string" || typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: "titleId and a valid action are required" });
  }

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) {
    return res.status(404).json({ error: "Title not found" });
  }

  const created = await prisma.userTitleAction.create({
    data: { userId: req.user!.userId, titleId, action: action as any },
  });

  res.status(201).json({ id: created.id });
});
