import { Router } from "express";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";
import { getPopularityScores } from "../lib/popularity";

export const directorsRouter = Router();

const PAGE_SIZE = 24;
const TOP_HITS_COUNT = 8;

function toApiDirector(row: {
  id: string;
  name: string;
  photoUrl: string | null;
  industry: string;
  knownForStyles: string;
  bio: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photoUrl,
    industry: JSON.parse(row.industry) as string[],
    knownForStyles: JSON.parse(row.knownForStyles) as string[],
    bio: row.bio,
  };
}

/** GET /api/directors?industry=&style=&cursor= — paginated grid. industry and style combine
 * with AND, per spec ("Bollywood" + "Known for: Action" narrows to directors matching both). */
directorsRouter.get("/", async (req, res) => {
  const industry = typeof req.query.industry === "string" && req.query.industry ? req.query.industry : null;
  const style = typeof req.query.style === "string" && req.query.style ? req.query.style : null;
  const cursor = Math.max(0, Number(req.query.cursor) || 0);

  const all = await prisma.director.findMany({ orderBy: { name: "asc" } });
  const filtered = all.filter((d) => {
    if (industry && !(JSON.parse(d.industry) as string[]).includes(industry)) return false;
    if (style && !(JSON.parse(d.knownForStyles) as string[]).includes(style)) return false;
    return true;
  });

  const page = filtered.slice(cursor, cursor + PAGE_SIZE);
  const nextCursor = cursor + PAGE_SIZE < filtered.length ? cursor + PAGE_SIZE : null;

  // Site-wide set of known_for_styles values actually present, for the style filter chips —
  // computed from ALL directors, not just this page, so the chip list doesn't shift per page.
  const availableStyles = [...new Set(all.flatMap((d) => JSON.parse(d.knownForStyles) as string[]))].sort();

  res.json({ directors: page.map(toApiDirector), total: filtered.length, nextCursor, availableStyles });
});

/** GET /api/directors/:id?genre= — same shape as the actor detail route, plus known_for_styles
 * (already included in toApiDirector). */
directorsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const director = await prisma.director.findUnique({ where: { id } });
  if (!director) return res.status(404).json({ error: "Director not found" });

  const links = await prisma.titleDirector.findMany({
    where: { directorId: id },
    include: { title: true },
  });
  if (links.length === 0) {
    return res.status(404).json({ error: "Director not found" });
  }

  const genre = typeof req.query.genre === "string" && req.query.genre ? req.query.genre : null;

  const allTitles = links.map((l) => l.title);
  const availableGenres = [
    ...new Set(allTitles.flatMap((t) => (JSON.parse(t.tags).genre as string[]) ?? [])),
  ].sort();

  const filteredTitles = genre
    ? allTitles.filter((t) => ((JSON.parse(t.tags).genre as string[]) ?? []).includes(genre))
    : allTitles;

  const popularity = await getPopularityScores();
  const ranked = [...filteredTitles].sort((a, b) => (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0));

  const topHits = ranked.slice(0, TOP_HITS_COUNT);
  const topHitIds = new Set(topHits.map((t) => t.id));
  const restOfFilmography = ranked.filter((t) => !topHitIds.has(t.id));

  res.json({
    director: toApiDirector(director),
    availableGenres,
    activeGenre: genre,
    topHits: topHits.map(toApiTitle),
    filmography: restOfFilmography.map(toApiTitle),
  });
});
