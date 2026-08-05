/**
 * Sources real poster/cover art from Wikipedia for every seeded title.
 *
 * Two-step lookup per title:
 *   1. action=query&list=search — resolve the correct Wikipedia article (titles alone are
 *      ambiguous: "Dune" the film vs. the novel, "The Boys" TV series vs. comic, etc.), using
 *      the title's type/year as a disambiguating hint in the search query.
 *   2. action=query&prop=pageimages — fetch that article's lead image as a thumbnail.
 *
 * This mirrors exactly how Wikipedia itself uses these images: low-resolution, for
 * identification purposes. Not scraped from any streaming platform.
 */
import { writeFileSync } from "fs";
import path from "path";
import { TITLES } from "../prisma/seed-data/titles";

const USER_AGENT = "WhatShouldIWatch-PosterFetch/1.0 (educational demo project; contact: n/a)";
const OUT_FILE = path.resolve(__dirname, "poster-urls.json");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typeHint(type: string, year: number): string {
  if (type === "movie") return `${year} film`;
  if (type === "show") return "TV series";
  if (type === "anime") return "anime";
  return "";
}

async function searchArticleTitle(name: string, hint: string): Promise<string | null> {
  const query = hint ? `${name} ${hint}` : name;
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&format=json&srlimit=1`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.query?.search?.[0];
  return hit?.title ?? null;
}

async function fetchPageImage(articleTitle: string): Promise<string | null> {
  // pilicense=free is the API default, but pinned explicitly here: most film/show posters are
  // non-free (fair-use) content restricted by Wikipedia's own policy to on-wiki identification
  // use — deliberately never requesting pilicense=any, which would surface those instead.
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    articleTitle,
  )}&prop=pageimages&format=json&pithumbsize=500&pilicense=free&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as any;
  return page?.thumbnail?.source ?? null;
}

async function main() {
  const results: Record<string, { posterUrl: string | null; articleTitle: string | null }> = {};
  let found = 0;
  let missing = 0;

  for (const [i, title] of TITLES.entries()) {
    const hint = typeHint(title.type, title.release_year);
    try {
      const articleTitle = await searchArticleTitle(title.name, hint);
      let posterUrl: string | null = null;
      if (articleTitle) {
        posterUrl = await fetchPageImage(articleTitle);
      }
      results[title.id] = { posterUrl, articleTitle };
      if (posterUrl) found++;
      else missing++;
      console.log(`[${i + 1}/${TITLES.length}] ${title.name} -> ${articleTitle ?? "NOT FOUND"} -> ${posterUrl ?? "no image"}`);
    } catch (e: any) {
      console.error(`[${i + 1}/${TITLES.length}] ${title.name} -> ERROR: ${e.message}`);
      results[title.id] = { posterUrl: null, articleTitle: null };
      missing++;
    }
    // polite rate limit
    await sleep(400);
  }

  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nDone. Found ${found}, missing ${missing}. Written to ${OUT_FILE}`);
}

main();
