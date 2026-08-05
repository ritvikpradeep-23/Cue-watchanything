import type { Title as PrismaTitle } from "@prisma/client";
import type { TitleSeed } from "@watch-recommender/shared";
import { prisma } from "./prisma";

function titleSeedFromRow(row: PrismaTitle): TitleSeed {
  return {
    id: row.id,
    name: row.name,
    type: row.type as TitleSeed["type"],
    plot_summary: row.plotSummary,
    cast: JSON.parse(row.cast) as string[],
    seasons: row.seasons,
    episodes: row.episodes,
    runtime_minutes: row.runtimeMinutes,
    release_year: row.releaseYear,
    platforms: JSON.parse(row.platforms) as TitleSeed["platforms"],
    poster_url: row.posterUrl,
    tags: JSON.parse(row.tags),
  };
}

/** DB is the runtime source of truth — titles added via the admin route show up immediately, no rebuild/redeploy needed. */
export async function getAllTitleSeeds(): Promise<TitleSeed[]> {
  const rows = await prisma.title.findMany();
  return rows.map(titleSeedFromRow);
}

export async function getTitleSeedById(id: string): Promise<TitleSeed | undefined> {
  const row = await prisma.title.findUnique({ where: { id } });
  return row ? titleSeedFromRow(row) : undefined;
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

/** Same camelCase API shape as toApiTitle(), but from a TitleSeed (used by the scoring engine) rather than a raw Prisma row. */
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
