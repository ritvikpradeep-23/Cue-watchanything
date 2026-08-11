import { Router } from "express";
import { prisma } from "../lib/prisma";
import { toApiTitle } from "../lib/titles";

export const browseRouter = Router();

const RESULT_LIMIT = 60;

/** Combined title-name / cast / tag search plus industry+genre filters, all resolved
 * server-side against the full catalog so the client never has to ship or filter the whole
 * dataset itself. Filters AND together (query narrows within whatever industry/genre are
 * already active), matching how the Browse page's chips + search box are meant to combine. */
browseRouter.get("/", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim().toLowerCase() : "";
  const industry = typeof req.query.industry === "string" && req.query.industry ? req.query.industry : null;
  const genre = typeof req.query.genre === "string" && req.query.genre ? req.query.genre : null;

  const rows = await prisma.title.findMany({ orderBy: { name: "asc" } });

  const matched = rows.filter((row) => {
    const title = toApiTitle(row);

    if (industry && !(title.tags.industry ?? []).includes(industry)) return false;
    if (genre && !(title.tags.genre ?? []).includes(genre)) return false;

    if (query) {
      const matchesName = title.name.toLowerCase().includes(query);
      const matchesCast = title.cast.some((c) => c.toLowerCase().includes(query));
      const matchesTags = Object.values(title.tags as Record<string, string[]>).some(
        (values) => Array.isArray(values) && values.some((v) => String(v).toLowerCase().includes(query)),
      );
      if (!matchesName && !matchesCast && !matchesTags) return false;
    }

    return true;
  });

  // Cross-link into the Actor Finder: a search matching an actor's name surfaces a direct
  // link to their profile (/actors/:id), not just the filtered title grid — see the actor
  // finder spec's edge cases.
  let actorMatch: { id: string; name: string } | null = null;
  if (query) {
    const actor = await prisma.actor.findFirst({ where: { name: { contains: query, mode: "insensitive" } } });
    if (actor) actorMatch = { id: actor.id, name: actor.name };
  }

  res.json({ titles: matched.slice(0, RESULT_LIMIT).map((row) => toApiTitle(row)), actorMatch });
});
