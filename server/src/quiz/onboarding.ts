import {
  CONTENT_RATINGS,
  ERA_SETTINGS,
  GENRES,
  LOVE_FACTORS,
  PACES,
  PLATFORMS,
  TONES,
} from "@watch-recommender/shared";
import type { Platform, TagProfile, TitleSeed } from "@watch-recommender/shared";
import type { HardFilters } from "../scoring/buildDeck";
import { mergeDeltas } from "../scoring/delta";
import type { Answers, QuizQuestion } from "./types";
import { buildConflictQuestion, detectGenreConflicts, resolveConflictDelta } from "./conflictCheck";

const label = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---------- static (non-branching) question defs ----------

const BASELINE_QUESTIONS: QuizQuestion[] = [
  {
    id: "type",
    prompt: "What are you in the mood for?",
    kind: "single",
    options: [
      { value: "show", label: "A show" },
      { value: "movie", label: "A movie" },
      { value: "anime", label: "Anime" },
      { value: "surprise", label: "Surprise me" },
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
    id: "pace",
    prompt: "Pace?",
    kind: "single",
    options: PACES.map((p) => ({ value: p, label: label(p) })),
  },
  {
    id: "tone",
    prompt: "Tone?",
    kind: "single",
    options: [
      { value: "gritty", label: "Dark & gritty" },
      { value: "hopeful", label: "Light & hopeful" },
      { value: "mixed", label: "Depends on the story" },
    ],
  },
  {
    id: "cast_style",
    prompt: "Cast style?",
    kind: "single",
    options: [
      { value: "ensemble", label: "Ensemble cast" },
      { value: "single-protagonist", label: "Single protagonist focus" },
    ],
  },
  {
    id: "content_comfort",
    prompt: "Content comfort?",
    kind: "single",
    options: CONTENT_RATINGS.map((c) => ({ value: c, label: label(c) })),
  },
  {
    id: "setting",
    prompt: "Setting/era?",
    kind: "single",
    options: [
      ...ERA_SETTINGS.map((e) => ({ value: e, label: label(e) })),
      { value: "no-preference", label: "No preference" },
    ],
  },
];

const CLOSING_QUESTIONS: QuizQuestion[] = [
  {
    id: "favorite_titles",
    prompt: "Name 3-5 titles you love (we'll match what we recognize).",
    kind: "text",
  },
  {
    id: "love_factor",
    prompt: "What do you love most about your favorites?",
    kind: "single",
    options: LOVE_FACTORS.map((l) => ({ value: l, label: label(l) })),
  },
  {
    id: "recency",
    prompt: "New releases or classics?",
    kind: "single",
    options: [
      { value: "new-buzzy", label: "Something everyone's talking about" },
      { value: "hidden-gem", label: "A hidden gem" },
    ],
  },
  {
    id: "platforms",
    prompt: "Which platforms do you have access to?",
    kind: "multi",
    options: PLATFORMS.map((p) => ({ value: p, label: p })),
  },
  {
    id: "length_commitment",
    prompt: "How much time are you realistically willing to put into this overall?",
    kind: "single",
    options: [
      { value: "single-sitting", label: "A single sitting (movie or one-off)" },
      { value: "short-binge", label: "A short binge (one season)" },
      { value: "multi-season", label: "A full multi-season commitment" },
      { value: "no-cap", label: "No cap — long-runners are fine" },
    ],
  },
];

// ---------- branch question builders ----------

function moodFollowupQuestion(moodNow: string): QuizQuestion | null {
  switch (moodNow) {
    case "feel-something":
      return {
        id: "mood_feel_followup",
        prompt: "Happy-cry, or sad-cry?",
        kind: "single",
        options: [
          { value: "happy", label: "Happy-cry" },
          { value: "sad", label: "Sad-cry" },
        ],
      };
    case "laugh":
      return {
        id: "mood_laugh_followup",
        prompt: "Witty & dialogue-driven, or absurd & silly?",
        kind: "single",
        options: [
          { value: "witty", label: "Witty & dialogue-driven" },
          { value: "silly", label: "Absurd & silly" },
        ],
      };
    case "think":
      return {
        id: "mood_think_followup",
        prompt: "A mystery to solve, or big ideas to chew on?",
        kind: "single",
        options: [
          { value: "mystery", label: "A mystery to solve" },
          { value: "ideas", label: "Big ideas to chew on" },
        ],
      };
    case "switch-off":
      return {
        id: "mood_switchoff_followup",
        prompt: "Background comfort-watch, or immersive escapism?",
        kind: "single",
        options: [
          { value: "background", label: "Background comfort-watch" },
          { value: "escapism", label: "Immersive escapism" },
        ],
      };
    default:
      return null;
  }
}

function contentComfortFollowupQuestion(contentComfort: string): QuizQuestion | null {
  if (contentComfort === "mature") {
    return {
      id: "mature_followup",
      prompt: "A couple quick checks on intensity:",
      kind: "toggle-pair",
      toggles: [
        {
          key: "graphic_violence_ok",
          label: "Okay with graphic violence?",
          options: [{ value: "ok", label: "Yes" }, { value: "not-ok", label: "No" }],
        },
        {
          key: "heavy_themes_ok",
          label: "Okay with heavy themes (loss, trauma)?",
          options: [{ value: "ok", label: "Yes" }, { value: "not-ok", label: "No" }],
        },
      ],
    };
  }
  if (contentComfort === "family") {
    return {
      id: "family_followup",
      prompt: "Okay with kid/teen leads carrying the story?",
      kind: "single",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "Prefer adult leads" },
      ],
    };
  }
  return null;
}

function typeFollowupQuestion(type: string): QuizQuestion | null {
  switch (type) {
    case "show":
      return {
        id: "show_structure_followup",
        prompt: "Wraps up each episode, or one big story across the season?",
        kind: "single",
        options: [
          { value: "episodic", label: "Wraps up each episode" },
          { value: "serialized", label: "One big story across the season" },
        ],
      };
    case "movie":
      return {
        id: "movie_structure_followup",
        prompt: "One-and-done, or open to a franchise/sequel-heavy universe?",
        kind: "single",
        options: [
          { value: "standalone", label: "One-and-done" },
          { value: "franchise", label: "Open to a franchise" },
        ],
      };
    case "anime":
      return {
        id: "anime_followup",
        prompt: "A couple quick anime preferences:",
        kind: "toggle-pair",
        toggles: [
          {
            key: "sub_or_dub",
            label: "Subbed or dubbed?",
            options: [{ value: "sub", label: "Subbed" }, { value: "dub", label: "Dubbed" }],
          },
          {
            key: "ongoing_ok",
            label: "Ongoing series okay, or want something completed?",
            options: [{ value: "ongoing", label: "Ongoing is fine" }, { value: "completed", label: "Prefer completed" }],
          },
        ],
      };
    default:
      return null;
  }
}

// ---------- ordered slot walk ----------

/** Returns the next unanswered question, or null when the quiz is complete. Called fresh each time — no hidden state. */
export function getNextOnboardingQuestion(answers: Answers): QuizQuestion | null {
  for (const q of BASELINE_QUESTIONS) {
    if (!(q.id in answers)) return q;
  }

  const moodFollowup = moodFollowupQuestion(answers["mood_now"]);
  if (moodFollowup && !(moodFollowup.id in answers)) return moodFollowup;

  const comfortFollowup = contentComfortFollowupQuestion(answers["content_comfort"]);
  if (comfortFollowup && !(comfortFollowup.id in answers)) return comfortFollowup;

  const typeFollowup = typeFollowupQuestion(answers["type"]);
  if (typeFollowup && !(typeFollowup.id in answers)) return typeFollowup;

  if (!("genres_enjoy" in answers)) {
    return {
      id: "genres_enjoy",
      prompt: "Genres you enjoy?",
      kind: "multi",
      options: GENRES.map((g) => ({ value: g, label: label(g) })),
    };
  }
  if (!("genres_avoid" in answers)) {
    return {
      id: "genres_avoid",
      prompt: "Genres you want to avoid?",
      kind: "multi",
      options: GENRES.map((g) => ({ value: g, label: label(g) })),
    };
  }

  const conflicts = detectGenreConflicts(answers);
  for (let i = 0; i < conflicts.length; i++) {
    const q = buildConflictQuestion(conflicts[i], i);
    if (!(q.id in answers)) return q;
  }

  for (const q of CLOSING_QUESTIONS) {
    if (!(q.id in answers)) return q;
  }

  return null;
}

// ---------- tag profile computation ----------

export function moodBaseDelta(moodNow: string): TagProfile {
  const d: TagProfile = {};
  if (moodNow === "think") d["cerebral-ideas"] = 1;
  if (moodNow === "switch-off") d["comfort-background"] = 1;
  if (moodNow === "feel-something") d["feel-good"] = 1;
  if (moodNow === "laugh") d["funny-witty"] = 1;
  return d;
}

function moodFollowupDelta(moodNow: string, followupValue: string): TagProfile {
  const d: TagProfile = {};
  if (moodNow === "feel-something") {
    if (followupValue === "happy") { d["feel-good"] = 2; d["intense"] = 1; }
    if (followupValue === "sad") { d["dark"] = 1; d["intense"] = 2; }
  } else if (moodNow === "laugh") {
    if (followupValue === "witty") d["funny-witty"] = 2;
    if (followupValue === "silly") d["funny-silly"] = 2;
  } else if (moodNow === "think") {
    if (followupValue === "mystery") d["cerebral-mystery"] = 2;
    if (followupValue === "ideas") d["cerebral-ideas"] = 2;
  } else if (moodNow === "switch-off") {
    if (followupValue === "background") d["comfort-background"] = 2;
    if (followupValue === "escapism") d["comfort-escapist"] = 2;
  }
  return d;
}

export function timeNowDelta(value: string): TagProfile {
  const d: TagProfile = {};
  if (value === "one-episode") d["short-binge"] = 0.5;
  if (value === "a-movie") d["single-sitting"] = 0.5;
  if (value === "ready-to-binge") d["multi-season"] = 0.5;
  if (value === "no-limit") d["long-runner"] = 0.5;
  return d;
}

export interface OnboardingResult {
  tagProfile: TagProfile;
  filters: HardFilters;
}

export function computeOnboardingProfile(answers: Answers, allTitles: TitleSeed[]): OnboardingResult {
  const deltas: TagProfile[] = [];

  deltas.push(timeNowDelta(answers["time_now"] ?? ""));
  deltas.push(moodBaseDelta(answers["mood_now"] ?? ""));

  const moodFollowupId = moodFollowupQuestion(answers["mood_now"])?.id;
  if (moodFollowupId && answers[moodFollowupId]) {
    deltas.push(moodFollowupDelta(answers["mood_now"], answers[moodFollowupId]));
  }

  if (answers["pace"]) deltas.push({ [answers["pace"]]: 2 });
  if (answers["tone"]) deltas.push({ [answers["tone"]]: 2 });
  if (answers["cast_style"]) deltas.push({ [answers["cast_style"]]: 2 });
  if (answers["content_comfort"]) deltas.push({ [answers["content_comfort"]]: 2 });
  if (answers["setting"] && answers["setting"] !== "no-preference") {
    deltas.push({ [answers["setting"]]: 2 });
  }

  if (answers["mature_followup"]) {
    const { graphic_violence_ok, heavy_themes_ok } = answers["mature_followup"];
    deltas.push({
      "graphic-violence": graphic_violence_ok === "ok" ? 1 : -2,
      "heavy-themes": heavy_themes_ok === "ok" ? 1 : -2,
    });
  }
  if (answers["family_followup"]) {
    deltas.push({ [answers["family_followup"] === "yes" ? "family" : "teen"]: 1 });
  }

  if (answers["show_structure_followup"]) deltas.push({ [answers["show_structure_followup"]]: 2 });
  if (answers["movie_structure_followup"]) deltas.push({ [answers["movie_structure_followup"]]: 2 });
  if (answers["anime_followup"]) {
    const { sub_or_dub, ongoing_ok } = answers["anime_followup"];
    const d: TagProfile = {};
    if (sub_or_dub === "sub") d["sub-available"] = 1;
    if (sub_or_dub === "dub") d["dub-available"] = 1;
    if (ongoing_ok === "ongoing") d["ongoing"] = 1;
    if (ongoing_ok === "completed") d["completed"] = 1;
    deltas.push(d);
  }

  const genresEnjoy: string[] = answers["genres_enjoy"] ?? [];
  const genresAvoid: string[] = answers["genres_avoid"] ?? [];
  const enjoyDelta: TagProfile = {};
  for (const g of genresEnjoy) enjoyDelta[g] = 2;
  deltas.push(enjoyDelta);
  const avoidDelta: TagProfile = {};
  for (const g of genresAvoid) avoidDelta[g] = -2;
  deltas.push(avoidDelta);

  const conflicts = detectGenreConflicts(answers);
  conflicts.forEach((conflict, i) => {
    const qId = `conflict_${i}_${conflict.avoidedGenre}`;
    const resolution = answers[qId];
    if (resolution) {
      deltas.push(resolveConflictDelta(conflict, resolution));
    }
  });

  if (answers["love_factor"]) deltas.push({ [answers["love_factor"]]: 2 });
  if (answers["recency"]) deltas.push({ [answers["recency"]]: 2 });

  const favoriteTitles: string[] = answers["favorite_titles"] ?? [];
  if (favoriteTitles.length > 0) {
    const normalized = favoriteTitles.map((t) => t.trim().toLowerCase()).filter(Boolean);
    for (const title of allTitles) {
      if (normalized.includes(title.name.toLowerCase())) {
        const seedDelta: TagProfile = {};
        const allTags = [
          ...title.tags.genre,
          ...title.tags.mood,
          ...title.tags.pace,
          ...title.tags.tone,
          ...title.tags.love_factor,
        ];
        for (const tag of allTags) seedDelta[tag] = (seedDelta[tag] ?? 0) + 0.5;
        deltas.push(seedDelta);
      }
    }
  }

  const platforms: Platform[] = answers["platforms"] ?? [];
  const lengthPreference = mapLengthCommitment(answers["length_commitment"]);

  return {
    tagProfile: mergeDeltas(...deltas),
    filters: { platforms, lengthPreference },
  };
}

export function mapLengthCommitment(value: string | undefined): HardFilters["lengthPreference"] {
  if (value === "single-sitting") return "single-sitting";
  if (value === "short-binge") return "short-binge";
  if (value === "multi-season") return "multi-season";
  if (value === "no-cap") return "no-cap";
  return undefined;
}
