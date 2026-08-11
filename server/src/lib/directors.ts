import { prisma } from "./prisma";
import { getPopularityScores } from "./popularity";

/** Top 2-3 genres by frequency across a director's linked titles, ties broken by whichever
 * genre appears in their highest-rated/most-popular title, final fallback alphabetical so the
 * result is always deterministic and stable across recomputation. Recomputed on-write whenever
 * a TitleDirector row is created for this director — cheap at this write volume, so no batch
 * job needed. */
export async function recomputeKnownForStyles(directorId: string): Promise<void> {
  const links = await prisma.titleDirector.findMany({
    where: { directorId },
    include: { title: { select: { id: true, tags: true } } },
  });

  if (links.length === 0) {
    await prisma.director.update({ where: { id: directorId }, data: { knownForStyles: "[]" } });
    return;
  }

  const popularity = await getPopularityScores();

  const freq = new Map<string, number>();
  const bestScoreForGenre = new Map<string, number>();
  for (const link of links) {
    const tags = JSON.parse(link.title.tags);
    const genres: string[] = tags.genre ?? [];
    const score = popularity.get(link.title.id) ?? 0;
    for (const g of genres) {
      freq.set(g, (freq.get(g) ?? 0) + 1);
      bestScoreForGenre.set(g, Math.max(bestScoreForGenre.get(g) ?? 0, score));
    }
  }

  const ranked = [...freq.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // frequency, descending
    const scoreDiff = (bestScoreForGenre.get(b[0]) ?? 0) - (bestScoreForGenre.get(a[0]) ?? 0);
    if (scoreDiff !== 0) return scoreDiff; // tie-break: highest-rated/most-popular title
    return a[0].localeCompare(b[0]); // final deterministic fallback
  });

  const top = ranked.slice(0, 3).map(([g]) => g);
  await prisma.director.update({ where: { id: directorId }, data: { knownForStyles: JSON.stringify(top) } });
}
