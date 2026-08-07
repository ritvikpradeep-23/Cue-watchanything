import type { TagProfile } from "../types";

/** Cosine similarity between two tag-profiles, normalized to 0..1 (negative raw cosine — fully
 * opposed taste — clamps to 0, since "negatively similar" isn't a meaningful taste-twin score).
 * Same overlap/closeness approach as scoreTitle, just profile-vs-profile instead of
 * profile-vs-title. Used both for the taste-twin similarity score and the chat/watch-together
 * eligibility threshold. */
export function compareProfiles(a: TagProfile, b: TagProfile): number {
  const tags = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const tag of tags) {
    const va = a[tag] ?? 0;
    const vb = b[tag] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, cosine);
}

/** Per-tag average of two absolute profiles — feeds Watch Together's merged deck. Deliberately
 * separate from mergeDeltas (delta.ts), which sums *deltas* onto a base profile; averaging two
 * people's full profiles is a different operation. */
export function mergeProfiles(a: TagProfile, b: TagProfile): TagProfile {
  const tags = new Set([...Object.keys(a), ...Object.keys(b)]);
  const merged: TagProfile = {};
  for (const tag of tags) {
    merged[tag] = ((a[tag] ?? 0) + (b[tag] ?? 0)) / 2;
  }
  return merged;
}
