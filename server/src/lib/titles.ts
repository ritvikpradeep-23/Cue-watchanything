import type { Title as PrismaTitle } from "@prisma/client";
import type { TitleSeed } from "@watch-recommender/shared";
import { TITLES } from "../../prisma/seed-data/titles";
import { prisma } from "./prisma";

/** In-memory catalog for the scoring engine — the DB stays the source of truth for API responses. */
export function getAllTitleSeeds(): TitleSeed[] {
  return TITLES;
}

export function getTitleSeedById(id: string): TitleSeed | undefined {
  return TITLES.find((t) => t.id === id);
}

export function toApiTitle(row: PrismaTitle) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    plotSummary: row.plotSummary,
    cast: JSON.parse(row.cast) as string[],
    seasons: row.seasons,
    episodes: row.episodes,
    runtimeMinutes: row.runtimeMinutes,
    releaseYear: row.releaseYear,
    platforms: JSON.parse(row.platforms) as string[],
    posterUrl: row.posterUrl,
    tags: JSON.parse(row.tags),
  };
}

export async function fetchTitleRow(id: string) {
  return prisma.title.findUnique({ where: { id } });
}

/** Same camelCase API shape as toApiTitle(), but from the in-memory TitleSeed catalog (used by the scoring engine) rather than a Prisma row. */
export function toApiTitleFromSeed(seed: TitleSeed) {
  return {
    id: seed.id,
    name: seed.name,
    type: seed.type,
    plotSummary: seed.plot_summary,
    cast: seed.cast,
    seasons: seed.seasons,
    episodes: seed.episodes,
    runtimeMinutes: seed.runtime_minutes,
    releaseYear: seed.release_year,
    platforms: seed.platforms,
    posterUrl: seed.poster_url,
    tags: seed.tags,
  };
}
