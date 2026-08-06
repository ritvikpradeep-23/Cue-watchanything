import type { Genre } from "../taxonomy";
import type { Answers, QuizQuestion } from "./types";

/** Which prior answers imply wanting a given genre — used to detect avoid-list contradictions. */
const IMPLIED_GENRE_SIGNALS: { source: string; matchValue: string; genre: Genre }[] = [
  { source: "mood_now", matchValue: "laugh", genre: "comedy" },
  { source: "mood_laugh_followup", matchValue: "witty", genre: "comedy" },
  { source: "mood_laugh_followup", matchValue: "silly", genre: "comedy" },
  { source: "mood_now", matchValue: "think", genre: "mystery" },
  { source: "mood_think_followup", matchValue: "mystery", genre: "mystery" },
  { source: "tone", matchValue: "gritty", genre: "thriller" },
  { source: "mood_now", matchValue: "feel-something", genre: "drama" },
];

export interface GenreConflict {
  avoidedGenre: Genre;
  impliedBySource: string;
}

/** Compares the avoid-list (Q13) against every earlier signal that implies wanting that genre. */
export function detectGenreConflicts(answers: Answers): GenreConflict[] {
  const avoidList: string[] = answers["genres_avoid"] ?? [];
  if (avoidList.length === 0) return [];

  const conflicts: GenreConflict[] = [];
  for (const signal of IMPLIED_GENRE_SIGNALS) {
    const answerValue = answers[signal.source];
    const matches = Array.isArray(answerValue)
      ? answerValue.includes(signal.matchValue)
      : answerValue === signal.matchValue;
    if (matches && avoidList.includes(signal.genre)) {
      if (!conflicts.find((c) => c.avoidedGenre === signal.genre)) {
        conflicts.push({ avoidedGenre: signal.genre, impliedBySource: signal.source });
      }
    }
  }
  // capped to 2 conflict-check slots (14-15)
  return conflicts.slice(0, 2);
}

const COMEDY_RESOLUTION_OPTIONS = [
  { value: "too-slapstick", label: "Too slapstick/silly" },
  { value: "too-cringe", label: "Too cringe/awkward-humor" },
  { value: "mixed-into-drama", label: "Prefer humor mixed into drama, not a whole comedy" },
  { value: "just-the-label", label: "Just don't like the label, open to funny moments elsewhere" },
];

const GENERIC_RESOLUTION_OPTIONS = [
  { value: "still-avoid", label: "Still avoid it" },
  { value: "open-to-it", label: "Actually, open to it after all" },
];

export function buildConflictQuestion(conflict: GenreConflict, index: number): QuizQuestion {
  const isComedy = conflict.avoidedGenre === "comedy";
  return {
    id: `conflict_${index}_${conflict.avoidedGenre}`,
    prompt: isComedy
      ? `You said you want a laugh, but marked comedy as something to avoid — what's the issue?`
      : `Earlier you leaned toward "${conflict.avoidedGenre}", but also marked it as something to avoid — what's going on?`,
    kind: "single",
    options: isComedy ? COMEDY_RESOLUTION_OPTIONS : GENERIC_RESOLUTION_OPTIONS,
  };
}

/** Reroutes tag weight instead of zeroing it out, per the resolution the user picked. */
export function resolveConflictDelta(conflict: GenreConflict, resolutionValue: string): Record<string, number> {
  const delta: Record<string, number> = {};
  if (conflict.avoidedGenre === "comedy") {
    switch (resolutionValue) {
      case "too-slapstick":
        delta["comedy"] = -1;
        delta["funny-witty"] = 1.5;
        break;
      case "too-cringe":
        delta["comedy"] = -1;
        delta["funny-witty"] = 1;
        break;
      case "mixed-into-drama":
        delta["comedy"] = -1.5;
        delta["drama"] = 1;
        delta["funny-witty"] = 1;
        break;
      case "just-the-label":
        delta["comedy"] = 0; // cancel the avoid-list penalty entirely
        delta["funny-witty"] = 0.5;
        delta["funny-silly"] = 0.5;
        break;
    }
    return delta;
  }
  // generic genres: either keep the avoid penalty or cancel it
  delta[conflict.avoidedGenre] = resolutionValue === "open-to-it" ? 0 : -1;
  return delta;
}

/** Genres from the avoid-list (Q13) that should be a HARD FILTER (excluded from the deck
 * outright), not just a soft down-weight. A genre that was flagged as a conflict gets rerouted
 * to a softer tag instead (see resolveConflictDelta) — comedy conflicts always reroute (the
 * user is nuancing, not blanket-avoiding), generic conflicts only stay hard-filtered if the
 * user explicitly reaffirmed "still avoid it". Genres with no contradicting earlier signal are
 * the straightforward case and are hard-filtered directly. */
export function computeAvoidGenreFilter(answers: Answers): Genre[] {
  const genresAvoid: string[] = answers["genres_avoid"] ?? [];
  if (genresAvoid.length === 0) return [];

  const conflicts = detectGenreConflicts(answers);
  const result: Genre[] = [];

  for (const g of genresAvoid) {
    const conflictIdx = conflicts.findIndex((c) => c.avoidedGenre === g);
    if (conflictIdx === -1) {
      result.push(g as Genre);
      continue;
    }
    if (g === "comedy") continue; // always reroutes to a softer tag, never hard-filtered
    const resolution = answers[`conflict_${conflictIdx}_${g}`];
    if (resolution === "still-avoid") result.push(g as Genre);
  }

  return result;
}
