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

  // anchor for the "Because you loved X" carousel — the user's own highest-rated title,
  // most recent first on ties, so it rotates as they rate more things.
  const topRating = await prisma.rating.findFirst({
    where: { userId: req.user!.userId },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    select: { titleId: true },
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      username: user.username,
      avatarUrl: user.avatarUrl,
      discoverable: user.discoverable,
    },
    topTags,
    tagProfile: profile?.tagProfile ?? {},
    hasCompletedOnboarding: !!profile,
    quizHistory,
    topRatedTitleId: topRating?.titleId ?? null,
    avoidGenres: profile?.filters.avoidGenres ?? [],
  });
});

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Sets/updates the public identity social features need — username is the one field that
 * gates them (see User.username's nullable comment in schema.prisma). */
profileRouter.patch("/", requireAuth, async (req: AuthedRequest, res) => {
  const { username, avatarUrl, discoverable } = req.body ?? {};
  const data: { username?: string; avatarUrl?: string | null; discoverable?: boolean } = {};

  if (username !== undefined) {
    if (typeof username !== "string" || !USERNAME_RE.test(username)) {
      return res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores" });
    }
    data.username = username;
  }
  if (avatarUrl !== undefined) {
    if (avatarUrl !== null && typeof avatarUrl !== "string") {
      return res.status(400).json({ error: "avatarUrl must be a string or null" });
    }
    data.avatarUrl = avatarUrl;
  }
  if (discoverable !== undefined) {
    if (typeof discoverable !== "boolean") {
      return res.status(400).json({ error: "discoverable must be a boolean" });
    }
    data.discoverable = discoverable;
  }

  const updated = await prisma.user
    .update({ where: { id: req.user!.userId }, data })
    .catch((e) => {
      if (e.code === "P2002") return "conflict" as const;
      throw e;
    });
  if (updated === "conflict") return res.status(409).json({ error: "That username is already taken" });

  res.json({ username: updated.username, avatarUrl: updated.avatarUrl, discoverable: updated.discoverable });
});

/** Taste Timeline — the user's full quiz_responses history (onboarding + every "pick next
 * show" session), never overwritten, so their taste profile can visibly evolve session to
 * session. */
profileRouter.get("/timeline", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.quizResponse.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, createdAt: true, watchedTitleId: true, resultingTagProfile: true },
  });

  const sessions = rows.map((r) => {
    const parsed = JSON.parse(r.resultingTagProfile) as { tagProfile: Record<string, number> };
    const topTags = Object.entries(parsed.tagProfile ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);
    return { id: r.id, kind: r.kind, createdAt: r.createdAt, watchedTitleId: r.watchedTitleId, topTags };
  });

  res.json({ sessions });
});

/** Clears swipe/watched history only — the stored tag-profile (QuizResponse) and public
 * ratings/reviews are left alone, so recommendations don't reset to cold-start. */
profileRouter.post("/reset-history", requireAuth, async (req: AuthedRequest, res) => {
  const { count } = await prisma.userTitleAction.deleteMany({ where: { userId: req.user!.userId } });
  res.json({ cleared: count });
});
