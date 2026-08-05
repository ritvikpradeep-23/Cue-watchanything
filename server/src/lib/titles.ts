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
