import { PrismaClient } from "@prisma/client";
import { TITLES } from "./seed-data/titles";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${TITLES.length} titles...`);

  await prisma.$transaction(
    TITLES.map((t) =>
      prisma.title.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          name: t.name,
          type: t.type,
          plotSummary: t.plot_summary,
          cast: JSON.stringify(t.cast),
          seasons: t.seasons,
          episodes: t.episodes,
          runtimeMinutes: t.runtime_minutes,
          releaseYear: t.release_year,
          platforms: JSON.stringify(t.platforms),
          posterUrl: t.poster_url,
          tags: JSON.stringify(t.tags),
        },
        update: {
          name: t.name,
          type: t.type,
          plotSummary: t.plot_summary,
          cast: JSON.stringify(t.cast),
          seasons: t.seasons,
          episodes: t.episodes,
          runtimeMinutes: t.runtime_minutes,
          releaseYear: t.release_year,
          platforms: JSON.stringify(t.platforms),
          posterUrl: t.poster_url,
          tags: JSON.stringify(t.tags),
        },
      }),
    ),
  );

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
