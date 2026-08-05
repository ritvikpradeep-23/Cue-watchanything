import { Router } from "express";
import { requireAuth, requireAdmin, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";
import { buildPosterSvg, posterSvgToDataUri } from "../lib/posterArt";
import { PLATFORMS, TITLE_TYPES } from "@watch-recommender/shared";

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
      posterUrl,
      tags: JSON.stringify(tags),
    },
  });

  res.status(201).json({ title: toApiTitle(created) });
});
