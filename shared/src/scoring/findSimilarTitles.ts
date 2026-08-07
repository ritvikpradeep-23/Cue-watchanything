import type { TitleSeed } from "../types";
import { sharedTagCount } from "./buildTop3";

type TaggedTitle = { id: string; tags: TitleSeed["tags"] };

/** Ranks every other title by shared "taste flavor" tags with `target` — the basis for both
 * "more like this" (title detail) and "because you loved X" (dashboard carousel). Only reads
 * `.id`/`.tags`, so it works with either a server-side TitleSeed or a client-side ApiTitle. */
export function findSimilarTitles<T extends TaggedTitle>(target: TaggedTitle, allTitles: T[], limit = 10): T[] {
  return allTitles
    .filter((t) => t.id !== target.id)
    .map((t) => ({ title: t, shared: sharedTagCount(target, t) }))
    .filter((r) => r.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((r) => r.title);
}
