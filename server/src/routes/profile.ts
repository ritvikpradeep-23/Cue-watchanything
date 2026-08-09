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
    select: { id: true, kind: true, createdAt: true, watchedTitleId: true, resultingTagProfile: true, answers: true },
  });

  if (rows.length === 0) return res.json({ sessions: [] });

  // Resolve every title each milestone should show a poster for, in one pass: watchedTitleId
  // for "next_show" sessions, and name-matched favorite_titles (same free-text matching
  // computeOnboardingProfile already does for scoring) for the "onboarding" session.
  const watchedIds = rows.map((r) => r.watchedTitleId).filter((id): id is string => !!id);
  const watchedTitles = watchedIds.length
    ? await prisma.title.findMany({ where: { id: { in: watchedIds } }, select: { id: true, name: true, posterUrl: true } })
    : [];
  const watchedById = new Map(watchedTitles.map((t) => [t.id, t]));

  const hasOnboarding = rows.some((r) => r.kind === "onboarding");
  const allTitlesForMatch = hasOnboarding
    ? await prisma.title.findMany({ select: { id: true, name: true, posterUrl: true } })
    : [];

  const sessions = rows.map((r) => {
    const parsed = JSON.parse(r.resultingTagProfile) as { tagProfile: Record<string, number> };
    const topTags = Object.entries(parsed.tagProfile ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    let milestoneTitles: { id: string; name: string; posterUrl: string }[] = [];
    if (r.kind === "onboarding") {
      const answers = JSON.parse(r.answers) as Record<string, unknown>;
      const favoriteNames = (Array.isArray(answers["favorite_titles"]) ? answers["favorite_titles"] : [])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim().toLowerCase());
      milestoneTitles = allTitlesForMatch.filter((t) => favoriteNames.includes(t.name.toLowerCase())).slice(0, 3);
    } else if (r.watchedTitleId) {
      const watched = watchedById.get(r.watchedTitleId);
      if (watched) milestoneTitles = [watched];
    }

    const tagLabel = topTags.slice(0, 2).map((t) => t.replace(/-/g, " ")).join(", ");
    const titleNames = milestoneTitles.map((t) => t.name).join(", ");
    const caption =
      r.kind === "onboarding"
        ? titleNames
          ? `Started with ${titleNames}${tagLabel ? ` → leaning toward ${tagLabel}` : ""}`
          : `Started your taste profile${tagLabel ? ` → leaning toward ${tagLabel}` : ""}`
        : titleNames
          ? `Watched ${titleNames}${tagLabel ? ` → shifted toward ${tagLabel}` : ""}`
          : `Picked a next show${tagLabel ? ` → shifted toward ${tagLabel}` : ""}`;

    return { id: r.id, kind: r.kind, createdAt: r.createdAt, watchedTitleId: r.watchedTitleId, topTags, milestoneTitles, caption };
  });

  res.json({ sessions });
});

/** Clears swipe/watched history only — the stored tag-profile (QuizResponse) and public
 * ratings/reviews are left alone, so recommendations don't reset to cold-start. */
profileRouter.post("/reset-history", requireAuth, async (req: AuthedRequest, res) => {
  const { count } = await prisma.userTitleAction.deleteMany({ where: { userId: req.user!.userId } });
  res.json({ cleared: count });
});
