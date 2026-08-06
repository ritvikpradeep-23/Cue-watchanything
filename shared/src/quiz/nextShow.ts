import { GENRES, LOVE_FACTORS, MOODS, PACES, PLATFORMS, TONES } from "../taxonomy";
import type { Platform } from "../taxonomy";
import type { TagProfile, TitleSeed } from "../types";
import { applyDelta, mergeDeltas } from "../scoring/delta";
import { flattenTags } from "../scoring/scoreTitle";
import { generateTagCheckQuestions } from "../scoring/tagCheckQuestion";
import { buildTop3, BuildTop3Result } from "../scoring/buildTop3";
import type { HardFilters } from "../scoring/buildDeck";
import { mapLengthCommitment, moodBaseDelta, timeNowDelta } from "./onboarding";
import type { Answers, QuizQuestion } from "./types";

const label = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const DROPPED_REASONS = [
  { value: "too-slow", label: "Too slow" },
  { value: "tone-not-right", label: "Tone wasn't right" },
  { value: "lost-interest-characters", label: "Lost interest in the characters" },
  { value: "ran-out-of-time", label: "Ran out of time" },
];

const DIAL_BUCKETS: Record<string, number> = {
  "stick-close": 0.15,
  balanced: 0.5,
  open: 0.85,
};

/** taste-relevant tags a user can plausibly ask for "more" or "less" of */
const RECALIBRATION_TAG_OPTIONS = [...GENRES, ...MOODS, ...PACES, ...TONES, ...LOVE_FACTORS].map((t) => ({
  value: t,
  label: label(t),
}));

export interface NextShowContext {
  baseProfile: TagProfile;
  /** carried forward unchanged from onboarding — this quiz only rechecks platforms/length,
   * it never re-asks genres_avoid or languages */
  baseFilters: HardFilters;
  watchedTitle: TitleSeed;
  allTitles: TitleSeed[];
  excludedIds: Set<string>;
}

function staticQuestions(watchedTitle: TitleSeed): QuizQuestion[] {
  const tagChecks = generateTagCheckQuestions(watchedTitle);
  return [
    {
      id: "finished_status",
      prompt: `Did you finish ${watchedTitle.name}?`,
      kind: "single",
      options: [
        { value: "finished", label: "Finished" },
        { value: "dropped", label: "Dropped partway" },
        { value: "not-started", label: "Haven't started yet" },
      ],
    },
    {
      id: "rating",
      prompt: "Rate it, 1 to 5.",
      kind: "single",
      options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
    },
    ...tagChecks.map((tc, i) => ({
      id: `tag_check_${i}`,
      prompt: tc.prompt,
      kind: "single" as const,
      options: tc.options.map((o) => ({ value: o.label, label: o.label })),
    })),
    {
      id: "love_factor_worked",
      prompt: "What worked best?",
      kind: "single",
      options: LOVE_FACTORS.map((l) => ({ value: l, label: label(l) })),
    },
    {
      id: "want_more",
      prompt: "Want more of next time?",
      kind: "multi",
      options: RECALIBRATION_TAG_OPTIONS,
    },
    {
      id: "want_less",
      prompt: "Want less of next time?",
      kind: "multi",
      options: RECALIBRATION_TAG_OPTIONS,
    },
    {
      id: "mood_now",
      prompt: "What's the mood right now?",
      kind: "single",
      options: [
        { value: "think", label: "I want to think" },
        { value: "switch-off", label: "I want to switch off" },
        { value: "feel-something", label: "I want to feel something" },
        { value: "laugh", label: "I want a laugh" },
      ],
    },
    {
      id: "time_now",
      prompt: "How much time do you have right now?",
      kind: "single",
      options: [
        { value: "one-episode", label: "One quick episode" },
        { value: "a-movie", label: "A full movie" },
        { value: "ready-to-binge", label: "Ready to binge" },
        { value: "no-limit", label: "No limit" },
      ],
    },
    {
      id: "length_commitment_recheck",
      prompt: "Total time commitment, still the same?",
      kind: "single",
      options: [
        { value: "single-sitting", label: "A single sitting" },
        { value: "short-binge", label: "A short binge" },
        { value: "multi-season", label: "A full multi-season commitment" },
        { value: "no-cap", label: "No cap — long-runners are fine" },
      ],
    },
    {
      id: "platforms_recheck",
      prompt: "Platform access, still the same?",
      kind: "multi",
      options: PLATFORMS.map((p) => ({ value: p, label: p })),
    },
    {
      id: "new_favorite",
      prompt: "Any new favorite to add? (optional)",
      kind: "text",
    },
    {
      id: "explore_exploit_dial",
      prompt: "Stick close to what just worked, or open to trying something different?",
      kind: "single",
      options: [
        { value: "stick-close", label: "Stick close to what worked" },
        { value: "balanced", label: "Somewhere in between" },
        { value: "open", label: "Open to trying something different" },
      ],
    },
  ];
}

const CONFIDENCE_QUESTION: QuizQuestion = {
  id: "confidence_check",
  prompt: "Show me 3 I can commit to, or 3 I can still swap?",
  kind: "single",
  options: [
    { value: "locked", label: "Show me 3 I can commit to" },
    { value: "swappable", label: "Show me 3 but let me swap any I'm unsure about" },
  ],
};

export function getNextNextShowQuestion(answers: Answers, ctx: NextShowContext): QuizQuestion | null {
  const questions = staticQuestions(ctx.watchedTitle);

  if (answers["finished_status"] === "dropped" && !("dropped_reason" in answers)) {
    return { id: "dropped_reason", prompt: "Why'd you drop it?", kind: "single", options: DROPPED_REASONS };
  }

  for (const q of questions) {
    if (!(q.id in answers)) return q;
  }

  // all pre-tiebreak slots answered — trial-run buildTop3 to see if a tie needs breaking
  if (!("tie_breaker" in answers)) {
    const trial = runBuildTop3(answers, ctx);
    if (trial.pendingTieBreak) {
      const { titleA, titleB, tagA, tagB, prompt } = trial.pendingTieBreak;
      return {
        id: "tie_breaker",
        prompt,
        kind: "single",
        options: [
          { value: titleA.id, label: `${titleA.name} (${tagA.replace(/-/g, " ")})` },
          { value: titleB.id, label: `${titleB.name} (${tagB.replace(/-/g, " ")})` },
        ],
      };
    }
  }

  if (!("confidence_check" in answers)) return CONFIDENCE_QUESTION;

  return null;
}

function droppedReasonDelta(watchedTitle: TitleSeed, reason: string): TagProfile {
  const d: TagProfile = {};
  switch (reason) {
    case "too-slow":
      d["slow-burn"] = -2;
      break;
    case "tone-not-right":
      for (const t of watchedTitle.tags.tone) d[t] = -2;
      break;
    case "lost-interest-characters":
      d["characters"] = -2;
      break;
    case "ran-out-of-time":
      for (const t of watchedTitle.tags.length_bucket) d[t] = -2;
      break;
  }
  return d;
}

function ratingDelta(watchedTitle: TitleSeed, rating: number): TagProfile {
  const magnitude = (rating - 3) * 1.5; // rating 1 -> -3, rating 5 -> +3, rating 3 -> 0
  const d: TagProfile = {};
  for (const tag of flattenTags(watchedTitle.tags)) d[tag] = (d[tag] ?? 0) + magnitude;
  return d;
}

/** Computes the session delta from questions 1-9, per the spec's narrowing algorithm step 1. */
export function computeNextShowDelta(answers: Answers, watchedTitle: TitleSeed, allTitles: TitleSeed[]): TagProfile {
  const deltas: TagProfile[] = [];

  if (answers["finished_status"] === "dropped" && answers["dropped_reason"]) {
    deltas.push(droppedReasonDelta(watchedTitle, answers["dropped_reason"]));
  }
  if (answers["rating"]) {
    deltas.push(ratingDelta(watchedTitle, Number(answers["rating"])));
  }

  const tagChecks = generateTagCheckQuestions(watchedTitle);
  tagChecks.forEach((tc, i) => {
    const chosenLabel = answers[`tag_check_${i}`];
    const option = tc.options.find((o) => o.label === chosenLabel);
    if (option) deltas.push({ [tc.tag]: option.delta });
  });

  if (answers["love_factor_worked"]) deltas.push({ [answers["love_factor_worked"]]: 2 });

  const wantMore: string[] = answers["want_more"] ?? [];
  const moreDelta: TagProfile = {};
  for (const t of wantMore) moreDelta[t] = 2;
  deltas.push(moreDelta);

  const wantLess: string[] = answers["want_less"] ?? [];
  const lessDelta: TagProfile = {};
  for (const t of wantLess) lessDelta[t] = -2;
  deltas.push(lessDelta);

  if (answers["mood_now"]) deltas.push(moodBaseDelta(answers["mood_now"]));
  if (answers["time_now"]) deltas.push(timeNowDelta(answers["time_now"]));

  const newFavorite: string[] = answers["new_favorite"] ?? [];
  if (newFavorite.length > 0) {
    // matched against the catalog the same lightweight way as onboarding's favorite-title seeding
    const normalized = newFavorite.map((t) => t.trim().toLowerCase()).filter(Boolean);
    for (const title of allTitles) {
      if (normalized.includes(title.name.toLowerCase())) {
        const seedDelta: TagProfile = {};
        for (const tag of flattenTags(title.tags)) seedDelta[tag] = (seedDelta[tag] ?? 0) + 0.5;
        deltas.push(seedDelta);
      }
    }
  }

  return mergeDeltas(...deltas);
}

function buildFilters(answers: Answers, baseFilters: HardFilters): HardFilters {
  const platforms: Platform[] = answers["platforms_recheck"] ?? [];
  return {
    ...baseFilters,
    platforms,
    lengthPreference: mapLengthCommitment(answers["length_commitment_recheck"]),
  };
}

function runBuildTop3(answers: Answers, ctx: NextShowContext): BuildTop3Result {
  const delta = computeNextShowDelta(answers, ctx.watchedTitle, ctx.allTitles);
  const sessionProfile = applyDelta(ctx.baseProfile, delta);
  const dial = DIAL_BUCKETS[answers["explore_exploit_dial"]] ?? 0.3;
  const excludedIds = new Set(ctx.excludedIds);
  excludedIds.add(ctx.watchedTitle.id);

  return buildTop3(sessionProfile, ctx.allTitles, {
    excludedIds,
    filters: buildFilters(answers, ctx.baseFilters),
    exploreExploitDial: dial,
    tieBreakWinnerId: answers["tie_breaker"],
  });
}

export interface NextShowResult {
  picks: TitleSeed[];
  sessionProfile: TagProfile;
  swappable: boolean;
}

export function submitNextShow(answers: Answers, ctx: NextShowContext): NextShowResult {
  const delta = computeNextShowDelta(answers, ctx.watchedTitle, ctx.allTitles);
  const sessionProfile = applyDelta(ctx.baseProfile, delta);
  const result = runBuildTop3(answers, ctx);
  return {
    picks: result.picks,
    sessionProfile,
    swappable: answers["confidence_check"] === "swappable",
  };
}
