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
