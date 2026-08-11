import { Router } from "express";
import { requireAuth, requireAdmin, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";
import { buildPosterSvg, posterSvgToDataUri } from "../lib/posterArt";
import { LANGUAGES, PLATFORMS, TITLE_TYPES } from "@watch-recommender/shared";

export const adminRouter = Router();

const TAG_CATEGORIES = [
  "genre",
  "mood",
  "pace",
  "tone",
  "cast_style",
  "content_rating",
  "intensity",
  "era_setting",
  "structure",
  "sub_dub",
  "completion_status",
  "recency",
  "length_bucket",
  "love_factor",
  "industry",
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Grows the dataset going forward without a seed-file rebuild: DB is the runtime source of
 * truth (see lib/titles.ts), so a new row here shows up in the scoring engine immediately. */
adminRouter.post("/titles", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const { name, type, plot_summary, cast, seasons, episodes, runtime_minutes, release_year, platforms, tags } = body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!TITLE_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${TITLE_TYPES.join(", ")}` });
  }
  if (typeof plot_summary !== "string" || !plot_summary.trim()) {
    return res.status(400).json({ error: "plot_summary is required" });
  }
  if (!Array.isArray(platforms) || platforms.length === 0 || !platforms.every((p) => PLATFORMS.includes(p))) {
    return res.status(400).json({ error: `platforms must be a non-empty array from ${PLATFORMS.join(", ")}` });
  }
  const languages = Array.isArray(body.languages) && body.languages.length > 0 ? body.languages : ["English"];
  if (!languages.every((l: string) => LANGUAGES.includes(l as any))) {
    return res.status(400).json({ error: `languages must be from ${LANGUAGES.join(", ")}` });
  }
  if (!tags || typeof tags !== "object") {
    return res.status(400).json({ error: "tags object is required" });
  }
  for (const category of TAG_CATEGORIES) {
    if (!Array.isArray(tags[category])) {
      return res.status(400).json({ error: `tags.${category} must be an array (can be empty)` });
    }
  }
  if (typeof release_year !== "number") {
    return res.status(400).json({ error: "release_year must be a number" });
  }

  const id = typeof body.id === "string" && body.id.trim() ? slugify(body.id) : slugify(name);
  const existing = await prisma.title.findUnique({ where: { id } });
  if (existing) {
    return res.status(409).json({ error: `A title with id "${id}" already exists` });
  }

  const posterUrl =
    typeof body.poster_url === "string" && body.poster_url.trim()
      ? body.poster_url
      : posterSvgToDataUri(
          buildPosterSvg({ id, name, type, year: release_year, primaryGenre: tags.genre?.[0] }),
        );

  const created = await prisma.title.create({
    data: {
      id,
      name,
      type,
      plotSummary: plot_summary,
      cast: JSON.stringify(Array.isArray(cast) ? cast : []),
      seasons: typeof seasons === "number" ? seasons : null,
      episodes: typeof episodes === "number" ? episodes : null,
      runtimeMinutes: typeof runtime_minutes === "number" ? runtime_minutes : null,
      releaseYear: release_year,
      platforms: JSON.stringify(platforms),
      languages: JSON.stringify(languages),
      posterUrl,
      tags: JSON.stringify(tags),
    },
  });

  res.status(201).json({ title: toApiTitle(created) });
});

/** Internal-only stats dashboard — no public-facing equivalent. Every figure here is derived
 * straight from existing tables, nothing fabricated. */
adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  const [totalUsers, totalTitles, actionCounts, ratingAgg, reviewCount, onboardingUserIds, recentSignups] =
    await Promise.all([
      prisma.user.count(),
      prisma.title.count(),
      prisma.userTitleAction.groupBy({ by: ["action"], _count: { _all: true } }),
      prisma.rating.aggregate({ _count: { _all: true } }),
      prisma.rating.count({ where: { comment: { not: null } } }),
      prisma.quizResponse.findMany({ where: { kind: "onboarding" }, distinct: ["userId"], select: { userId: true } }),
      prisma.user.findMany({ select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    ]);

  const actionByType = Object.fromEntries(actionCounts.map((a) => [a.action, a._count._all])) as Record<string, number>;

  // signups bucketed by day — cheap enough client-side-free, and the dataset is small
  const signupsByDay = new Map<string, number>();
  for (const u of recentSignups) {
    const day = u.createdAt.toISOString().slice(0, 10);
    signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
  }

  const likeCounts = await prisma.userTitleAction.groupBy({
    by: ["titleId"],
    where: { action: { in: ["like", "super_like"] } },
    _count: { _all: true },
    orderBy: { _count: { titleId: "desc" } },
    take: 10,
  });
  const watchedCounts = await prisma.userTitleAction.groupBy({
    by: ["titleId"],
    where: { action: "watched" },
    _count: { _all: true },
    orderBy: { _count: { titleId: "desc" } },
    take: 10,
  });
  const titleIds = [...new Set([...likeCounts.map((r) => r.titleId), ...watchedCounts.map((r) => r.titleId)])];
  const titleRows = await prisma.title.findMany({ where: { id: { in: titleIds } }, select: { id: true, name: true } });
  const nameById = new Map(titleRows.map((t) => [t.id, t.name]));

  res.json({
    totalUsers,
    totalTitles,
    signupsByDay: [...signupsByDay.entries()].map(([day, count]) => ({ day, count })),
    quizCompletion: {
      usersCompleted: onboardingUserIds.length,
      totalUsers,
      rate: totalUsers > 0 ? onboardingUserIds.length / totalUsers : 0,
    },
    activity: {
      swipes: (actionByType.pass ?? 0) + (actionByType.like ?? 0) + (actionByType.super_like ?? 0),
      watched: actionByType.watched ?? 0,
      ratings: ratingAgg._count._all,
      reviews: reviewCount,
    },
    mostLiked: likeCounts.map((r) => ({ titleId: r.titleId, name: nameById.get(r.titleId) ?? r.titleId, count: r._count._all })),
    mostWatched: watchedCounts.map((r) => ({ titleId: r.titleId, name: nameById.get(r.titleId) ?? r.titleId, count: r._count._all })),
  });
});

/** Paginated user list, searchable by email — the admin panel's user directory. */
adminRouter.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = 25;
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";

  const where = query ? { email: { contains: query, mode: "insensitive" as const } } : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, role: true, createdAt: true, bannedAt: true },
    }),
  ]);

  res.json({ users, total, page, pageSize });
});

/** Per-user activity view — everything an admin needs to see about one account. */
adminRouter.get("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, createdAt: true, bannedAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const [actions, ratings, quizResponses] = await Promise.all([
    prisma.userTitleAction.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { title: { select: { name: true } } },
    }),
    prisma.rating.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      include: { title: { select: { name: true } } },
    }),
    prisma.quizResponse.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, createdAt: true, watchedTitleId: true },
    }),
  ]);

  res.json({
    user,
    actions: actions.map((a) => ({ id: a.id, titleId: a.titleId, titleName: a.title.name, action: a.action, createdAt: a.createdAt })),
    ratings: ratings.map((r) => ({ id: r.id, titleId: r.titleId, titleName: r.title.name, rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
    quizResponses,
  });
});

/** Grant/revoke admin. Role is baked into the JWT at login, so this takes effect on the
 * target's next login — same re-login requirement as every other role check in this app. */
adminRouter.post("/users/:id/role", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { role } = req.body ?? {};
  if (role !== "USER" && role !== "ADMIN") {
    return res.status(400).json({ error: "role must be USER or ADMIN" });
  }
  if (id === req.user!.userId && role === "USER") {
    return res.status(400).json({ error: "You can't demote yourself" });
  }
  const user = await prisma.user.update({ where: { id }, data: { role } }).catch(() => null);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, role: user.role });
});

/** Permanent ban — the row is never deleted, so the email stays taken forever (never
 * re-registerable) and login rejects with a clear banned message (see routes/auth.ts). */
adminRouter.post("/users/:id/ban", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (id === req.user!.userId) {
    return res.status(400).json({ error: "You can't ban yourself" });
  }
  const user = await prisma.user.update({ where: { id }, data: { bannedAt: new Date() } }).catch(() => null);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, bannedAt: user.bannedAt });
});

/** Reverses a ban — clears bannedAt so the account can log in again. The row/email was never
 * touched by ban itself, so this is a straightforward clear, not a data restore. */
adminRouter.post("/users/:id/unban", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { bannedAt: null } }).catch(() => null);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, bannedAt: user.bannedAt });
});

/** Force-logout, distinct from ban — bumps tokenVersion so every already-issued JWT for this
 * user fails requireAuth's version check on its next request, without touching bannedAt. The
 * user can log back in immediately afterward and gets a fresh token with the new version. */
adminRouter.post("/users/:id/kick", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (id === req.user!.userId) {
    return res.status(400).json({ error: "You can't kick yourself" });
  }
  const user = await prisma.user
    .update({ where: { id }, data: { tokenVersion: { increment: 1 } } })
    .catch(() => null);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, tokenVersion: user.tokenVersion });
});

/** Moderation queue — reports filed by users, most recent first. */
adminRouter.get("/reports", requireAuth, requireAdmin, async (req, res) => {
  const status = req.query.status === "REVIEWED" ? "REVIEWED" : req.query.status === "all" ? undefined : "PENDING";
  const reports = await prisma.report.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { email: true } },
      reportedUser: { select: { email: true } },
    },
  });
  res.json({
    reports: reports.map((r) => ({
      id: r.id,
      reporterEmail: r.reporter.email,
      reportedUserId: r.reportedUserId,
      reportedUserEmail: r.reportedUser.email,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    })),
  });
});

adminRouter.post("/reports/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const report = await prisma.report
    .update({ where: { id }, data: { status: "REVIEWED", reviewedAt: new Date() } })
    .catch(() => null);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ id: report.id, status: report.status });
});
