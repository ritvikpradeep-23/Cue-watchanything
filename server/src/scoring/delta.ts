import type { TagProfile } from "@watch-recommender/shared";

/** Returns a new profile with weights adjusted — never mutates the input (stored profile stays intact). */
export function applyDelta(baseProfile: TagProfile, delta: TagProfile): TagProfile {
  const next: TagProfile = { ...baseProfile };
  for (const [tag, amount] of Object.entries(delta)) {
    next[tag] = (next[tag] ?? 0) + amount;
  }
  return next;
}

export function addWeight(delta: TagProfile, tag: string, amount: number): void {
  delta[tag] = (delta[tag] ?? 0) + amount;
}

/** Merges multiple partial deltas (e.g. from several quiz questions) into one. */
export function mergeDeltas(...deltas: TagProfile[]): TagProfile {
  const merged: TagProfile = {};
  for (const d of deltas) {
    for (const [tag, amount] of Object.entries(d)) {
      merged[tag] = (merged[tag] ?? 0) + amount;
    }
  }
  return merged;
}
