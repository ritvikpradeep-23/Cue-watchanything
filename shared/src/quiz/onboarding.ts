import {
  CONTENT_RATINGS,
  ERA_SETTINGS,
  GENRES,
  INDUSTRIES,
  LANGUAGES,
  LOVE_FACTORS,
  PACES,
  PLATFORMS,
  TONES,
} from "../taxonomy";
import type { ContentRating, Intensity, Language, Platform } from "../taxonomy";
import type { TagProfile, TitleSeed } from "../types";
import type { HardFilters } from "../scoring/buildDeck";
import { mergeDeltas } from "../scoring/delta";
import type { Answers, QuizQuestion } from "./types";
import {
  buildConflictQuestion,
  computeAvoidGenreFilter,
  detectGenreConflicts,
  resolveConflictDelta,
} from "./conflictCheck";

/**
 * Per-answer weight scale. Real user testing showed a ~3-4-out-of-40 hit rate in the swipe
 * deck — everything was weighted too evenly, diluting the signal from the answers that
 * actually predict taste. Genre / mood / content-comfort are high-signal and weight heavily;
 * era/setting and new-vs-classic are low-signal and weight lightly.
 */
const WEIGHT = {
  genre: 3,
  mood: 1.5,
  moodFollowup: 3,
  // contentComfort removed — Q8 is now a hard filter (maxContentRating), not a weighted tag.
  intensityOk: 1.5,
  // intensityNotOk removed — a "not okay" answer is now a hard exclusion (excludeIntensity),
  // not a negative weight.
  familyFollowup: 1.5,
  pace: 2,
  tone: 2,
  castStyle: 1.5,
  structureFollowup: 1.5,
  animeFollowup: 1,
  loveFactor: 2,
  industry: 1.5,
  eraSetting: 0.75, // low-signal
  recency: 0.75, // low-signal
  timeNow: 0.5,
  favoriteSeed: 0.5,
  // type-path questions (movie/show/anime) — concrete, high-signal per the spec's own framing
  runtimeBucket: 2,
  rewatchValue: 2,
  prestigeVsBlockbuster: 2,
  showFormat: 3, // deliberately concrete/high-signal, per spec
  seasonCommitment: 2,
  anthologyVsContinuous: 2,
  bingeVsWeekly: 1, // viewing-habit preference, lower-signal than taste itself
  episodeCountBucket: 2,
  demographic: 2,
} as const;

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
  // Q2 — language is asked immediately after type, before anything else, and applied as a
  // hard filter at scoring time (see filters.languages in buildDeck) — an independent filter
  // from `type`, not linked to it (see edge cases in the quiz spec).
  {
    id: "languages",
    prompt: "What language(s) do you want to watch in?",
    kind: "multi",
    options: [
      ...LANGUAGES.map((l) => ({ value: l, label: l })),
      { value: "any", label: "Any language, I don't mind subtitles" },
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

/** Platforms plausible for a given language, shown first — display-order nicety only, never
 * hides a platform outright (every platform still appears, just reordered). */
const LANGUAGE_PLATFORM_AFFINITY: Partial<Record<string, string[]>> = {
  Hindi: ["Prime Video", "Disney+ Hotstar", "Netflix"],
  Telugu: ["Prime Video", "Disney+ Hotstar", "Netflix"],
  Tamil: ["Prime Video", "Disney+ Hotstar", "Netflix"],
  Malayalam: ["Prime Video", "Disney+ Hotstar", "Netflix"],
  Japanese: ["Crunchyroll", "HIDIVE", "Netflix"],
  Korean: ["Netflix", "Disney+ Hotstar"],
};

function platformsQuestion(answers: Answers): QuizQuestion {
  const languages: string[] = answers["languages"] ?? [];
  const priority = new Set<string>();
  for (const lang of languages) {
    for (const p of LANGUAGE_PLATFORM_AFFINITY[lang] ?? []) priority.add(p);
  }
  const ordered = [...priority, ...PLATFORMS.filter((p) => !priority.has(p))];
  return {
    id: "platforms",
    prompt: "Which platforms do you have access to?",
    kind: "multi",
    options: ordered.map((p) => ({ value: p, label: p })),
  };
}

const CLOSING_QUESTIONS: QuizQuestion[] = [
  {
    id: "favorite_titles",
    prompt: "Name up to 3 titles you love (we'll match what we recognize).",
    kind: "text3",
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
  // platforms is asked here via platformsQuestion(answers) in the walk function, not this
  // static array, since its option order depends on the language answer.
  {
    id: "industry",
    prompt: "Any particular film industries you're drawn to?",
    kind: "multi",
    options: [
      ...INDUSTRIES.map((i) => ({ value: i, label: i })),
      { value: "no-preference", label: "No preference" },
    ],
  },
];

const LENGTH_COMMITMENT_QUESTION: QuizQuestion = {
  id: "length_commitment",
  prompt: "How much time are you realistically willing to put into this overall?",
  kind: "single",
  options: [
    { value: "single-sitting", label: "A single sitting (movie or one-off)" },
    { value: "short-binge", label: "A short binge (one season)" },
    { value: "multi-season", label: "A full multi-season commitment" },
    { value: "no-cap", label: "No cap — long-runners are fine" },
  ],
};

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

// ---------- type-specific path question builders ----------
// Fires after the shared baseline (through industry/length_commitment), skipped entirely when
// type is "surprise" (or unanswered) — the type-specific path questions are ONLY reachable
// through their own type's branch below, so e.g. a favorite title matching an anime title can
// never surface the anime demographic question while type is "movie" (see quiz spec edge cases).

const MOVIE_PATH_QUESTIONS: QuizQuestion[] = [
  {
    id: "runtime_tolerance",
    prompt: "Runtime tolerance?",
    kind: "single",
    options: [
      { value: "short", label: "Short (under 90 min)" },
      { value: "standard", label: "Standard (90-120 min)" },
      { value: "long", label: "Long (120-150 min)" },
      { value: "epic", label: "Epic (150+ min)" },
    ],
  },
  // movie_structure_followup is dispatched via typeFollowupQuestion() below, not this array —
  // same question, now asked as part of the movie path instead of before genres_enjoy.
  {
    id: "rewatch_value",
    prompt: "A one-time experience, or something you'd want to watch again?",
    kind: "single",
    options: [
      { value: "one-time", label: "One-time experience" },
      { value: "rewatchable", label: "Want to watch it again" },
    ],
  },
  {
    id: "prestige_vs_blockbuster",
    prompt: "Prestige/awards-style, or blockbuster/popcorn entertainment?",
    kind: "single",
    options: [
      { value: "prestige", label: "Prestige/awards-style" },
      { value: "blockbuster", label: "Blockbuster/popcorn entertainment" },
    ],
  },
];

const SHOW_PATH_QUESTIONS: QuizQuestion[] = [
  {
    id: "show_format",
    prompt: "What kind of show?",
    kind: "single",
    options: [
      { value: "sitcom-ensemble", label: "Comedy/sitcom ensemble (Friends, Brooklyn 99 style)" },
      { value: "prestige-drama", label: "Prestige drama (slow-building, character-driven)" },
      { value: "thriller-suspense", label: "Thriller/suspense (edge-of-your-seat)" },
      { value: "procedural", label: "Procedural (case-of-the-week structure)" },
    ],
  },
  // show_structure_followup is dispatched via typeFollowupQuestion() below, not this array.
  {
    id: "season_commitment",
    prompt: "Season commitment?",
    kind: "single",
    options: [
      { value: "limited-series", label: "Limited series (1 season)" },
      { value: "multi-season-ok", label: "Multi-season okay" },
      { value: "long-runner-ok", label: "Long-runner okay" },
    ],
  },
  {
    id: "anthology_vs_continuous",
    prompt: "A different story/cast each season, or one continuous storyline?",
    kind: "single",
    options: [
      { value: "anthology", label: "Different story/cast each season" },
      { value: "continuous-storyline", label: "One continuous storyline" },
    ],
  },
  {
    id: "binge_vs_weekly",
    prompt: "Binge it all, or a weekly-release pace?",
    kind: "single",
    options: [
      { value: "binge-preferred", label: "Binge it all" },
      { value: "weekly-preferred", label: "Weekly-release pace" },
    ],
  },
];

const ANIME_EPISODE_COUNT_QUESTION: QuizQuestion = {
  id: "episode_count_tolerance",
  prompt: "Episode-count tolerance?",
  kind: "single",
  options: [
    { value: "short", label: "Short (12-13 episodes)" },
    { value: "standard", label: "Standard (24-26 episodes)" },
    { value: "long-runner", label: "Long-runner (50-100+ episodes)" },
  ],
};

const ANIME_DEMOGRAPHIC_QUESTION: QuizQuestion = {
  id: "demographic",
  prompt: "Any demographic category you gravitate toward?",
  kind: "single",
  options: [
    { value: "shonen", label: "Shonen" },
    { value: "seinen", label: "Seinen" },
    { value: "shojo", label: "Shojo" },
    { value: "josei", label: "Josei" },
  ],
};

/** True only if a Q12 favorite title matches a title tagged type:anime in the dataset — the
 * gate for the anime path's bonus demographic question. Requires the caller to pass the
 * dataset (allTitles); with no dataset available, conservatively returns false rather than
 * asking a question we can't actually justify. */
function favoriteMatchesAnime(answers: Answers, allTitles?: { name: string; type: string }[]): boolean {
  if (!allTitles || allTitles.length === 0) return false;
  const favorites: string[] = (answers["favorite_titles"] ?? []).map((t: string) => t.trim().toLowerCase());
  if (favorites.length === 0) return false;
  return allTitles.some((t) => t.type === "anime" && favorites.includes(t.name.toLowerCase()));
}

function typePathQuestions(
  type: string,
  answers: Answers,
  allTitles?: { name: string; type: string }[],
): QuizQuestion[] {
  if (type === "movie") {
    const structureFollowup = typeFollowupQuestion("movie")!;
    return [MOVIE_PATH_QUESTIONS[0], structureFollowup, MOVIE_PATH_QUESTIONS[1], MOVIE_PATH_QUESTIONS[2]];
  }
  if (type === "show") {
    const structureFollowup = typeFollowupQuestion("show")!;
    return [
      SHOW_PATH_QUESTIONS[0],
      structureFollowup,
      SHOW_PATH_QUESTIONS[1],
      SHOW_PATH_QUESTIONS[2],
      SHOW_PATH_QUESTIONS[3],
    ];
  }
  if (type === "anime") {
    const animeFollowup = typeFollowupQuestion("anime")!;
    const questions = [animeFollowup, ANIME_EPISODE_COUNT_QUESTION];
    if (favoriteMatchesAnime(answers, allTitles)) questions.push(ANIME_DEMOGRAPHIC_QUESTION);
    return questions;
  }
  return [];
}

// ---------- ordered slot walk ----------

/** Returns the next unanswered question, or null when the quiz is complete. Called fresh each
 * time — no hidden state. `allTitles` (name+type only needed) gates the anime path's
 * conditional demographic question; omit it and that question is simply never asked. */
export function getNextOnboardingQuestion(
  answers: Answers,
  allTitles?: { name: string; type: string }[],
): QuizQuestion | null {
  for (const q of BASELINE_QUESTIONS) {
    if (!(q.id in answers)) return q;
  }

  const moodFollowup = moodFollowupQuestion(answers["mood_now"]);
  if (moodFollowup && !(moodFollowup.id in answers)) return moodFollowup;

  const comfortFollowup = contentComfortFollowupQuestion(answers["content_comfort"]);
  if (comfortFollowup && !(comfortFollowup.id in answers)) return comfortFollowup;

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

  // favorite_titles, love_factor, recency come from CLOSING_QUESTIONS; platforms is dynamic
  // (language-dependent option order) so it's dispatched here instead of from that array.
  for (const q of CLOSING_QUESTIONS) {
    if (q.id === "favorite_titles" || q.id === "love_factor" || q.id === "recency") {
      if (!(q.id in answers)) return q;
    }
  }
  if (!("platforms" in answers)) return platformsQuestion(answers);
  const industryQuestion = CLOSING_QUESTIONS.find((q) => q.id === "industry")!;
  if (!("industry" in answers)) return industryQuestion;

  const type = answers["type"];

  // length_commitment is the shared baseline's generic "total time" question — season_commitment
  // (show) and episode_count_tolerance (anime) replace it for those paths, so it's only asked
  // for movie/surprise.
  if ((type === "movie" || type === "surprise" || !type) && !("length_commitment" in answers)) {
    return LENGTH_COMMITMENT_QUESTION;
  }

  if (!type || type === "surprise") return null; // no type-specific path for "surprise me"

  for (const q of typePathQuestions(type, answers, allTitles)) {
    if (!(q.id in answers)) return q;
  }

  return null;
}

// ---------- tag profile computation ----------

export function moodBaseDelta(moodNow: string): TagProfile {
  const d: TagProfile = {};
  if (moodNow === "think") d["cerebral-ideas"] = WEIGHT.mood;
  if (moodNow === "switch-off") d["comfort-background"] = WEIGHT.mood;
  if (moodNow === "feel-something") d["feel-good"] = WEIGHT.mood;
  if (moodNow === "laugh") d["funny-witty"] = WEIGHT.mood;
  return d;
}

function moodFollowupDelta(moodNow: string, followupValue: string): TagProfile {
  const d: TagProfile = {};
  const w = WEIGHT.moodFollowup;
  if (moodNow === "feel-something") {
    if (followupValue === "happy") { d["feel-good"] = w; d["intense"] = w / 2; }
    if (followupValue === "sad") { d["dark"] = w / 2; d["intense"] = w; }
  } else if (moodNow === "laugh") {
    if (followupValue === "witty") d["funny-witty"] = w;
    if (followupValue === "silly") d["funny-silly"] = w;
  } else if (moodNow === "think") {
    if (followupValue === "mystery") d["cerebral-mystery"] = w;
    if (followupValue === "ideas") d["cerebral-ideas"] = w;
  } else if (moodNow === "switch-off") {
    if (followupValue === "background") d["comfort-background"] = w;
    if (followupValue === "escapism") d["comfort-escapist"] = w;
  }
  return d;
}

export function timeNowDelta(value: string): TagProfile {
  const d: TagProfile = {};
  const w = WEIGHT.timeNow;
  if (value === "one-episode") d["short-binge"] = w;
  if (value === "a-movie") d["single-sitting"] = w;
  if (value === "ready-to-binge") d["multi-season"] = w;
  if (value === "no-limit") d["long-runner"] = w;
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

  if (answers["pace"]) deltas.push({ [answers["pace"]]: WEIGHT.pace });
  if (answers["tone"]) deltas.push({ [answers["tone"]]: WEIGHT.tone });
  if (answers["cast_style"]) deltas.push({ [answers["cast_style"]]: WEIGHT.castStyle });
  // content_comfort is now a HARD FILTER (filters.maxContentRating below), not a weighted tag —
  // a "family-friendly" answer must exclude mature titles outright, not just get outscored by
  // family-tagged ones. Same pattern as genres_avoid.
  if (answers["setting"] && answers["setting"] !== "no-preference") {
    deltas.push({ [answers["setting"]]: WEIGHT.eraSetting });
  }

  const excludeIntensity: Intensity[] = [];
  if (answers["mature_followup"]) {
    const { graphic_violence_ok, heavy_themes_ok } = answers["mature_followup"];
    // "okay with X" stays a soft positive weight; "not okay" is now a HARD FILTER
    // (excludeIntensity below) instead of a negative weight — a title carrying an
    // explicitly-rejected intensity tag must never surface, not just score lower.
    const delta: TagProfile = {};
    if (graphic_violence_ok === "ok") delta["graphic-violence"] = WEIGHT.intensityOk;
    else excludeIntensity.push("graphic-violence");
    if (heavy_themes_ok === "ok") delta["heavy-themes"] = WEIGHT.intensityOk;
    else excludeIntensity.push("heavy-themes");
    deltas.push(delta);
  }
  if (answers["family_followup"]) {
    deltas.push({ [answers["family_followup"] === "yes" ? "family" : "teen"]: WEIGHT.familyFollowup });
  }

  if (answers["show_structure_followup"]) deltas.push({ [answers["show_structure_followup"]]: WEIGHT.structureFollowup });
  if (answers["movie_structure_followup"]) deltas.push({ [answers["movie_structure_followup"]]: WEIGHT.structureFollowup });
  if (answers["anime_followup"]) {
    const { sub_or_dub, ongoing_ok } = answers["anime_followup"];
    const d: TagProfile = {};
    if (sub_or_dub === "sub") d["sub-available"] = WEIGHT.animeFollowup;
    if (sub_or_dub === "dub") d["dub-available"] = WEIGHT.animeFollowup;
    if (ongoing_ok === "ongoing") d["ongoing"] = WEIGHT.animeFollowup;
    if (ongoing_ok === "completed") d["completed"] = WEIGHT.animeFollowup;
    deltas.push(d);
  }

  // ---- type-specific path (movie/show/anime) ----
  if (answers["runtime_tolerance"]) deltas.push({ [answers["runtime_tolerance"]]: WEIGHT.runtimeBucket });
  if (answers["rewatch_value"]) deltas.push({ [answers["rewatch_value"]]: WEIGHT.rewatchValue });
  if (answers["prestige_vs_blockbuster"]) {
    deltas.push({ [answers["prestige_vs_blockbuster"]]: WEIGHT.prestigeVsBlockbuster });
  }
  if (answers["show_format"]) deltas.push({ [answers["show_format"]]: WEIGHT.showFormat });
  if (answers["season_commitment"]) {
    // Maps onto the existing length_bucket tag, same axis as time_now/length_commitment,
    // rather than a parallel new category — see quiz spec's "replaces the generic time
    // commitment question" note.
    const seasonToLengthBucket: Record<string, string> = {
      "limited-series": "short-binge",
      "multi-season-ok": "multi-season",
      "long-runner-ok": "long-runner",
    };
    const mapped = seasonToLengthBucket[answers["season_commitment"]];
    if (mapped) deltas.push({ [mapped]: WEIGHT.seasonCommitment });
  }
  if (answers["anthology_vs_continuous"]) {
    deltas.push({ [answers["anthology_vs_continuous"]]: WEIGHT.anthologyVsContinuous });
  }
  if (answers["binge_vs_weekly"]) deltas.push({ [answers["binge_vs_weekly"]]: WEIGHT.bingeVsWeekly });
  if (answers["episode_count_tolerance"]) {
    deltas.push({ [answers["episode_count_tolerance"]]: WEIGHT.episodeCountBucket });
  }
  if (answers["demographic"]) deltas.push({ [answers["demographic"]]: WEIGHT.demographic });

  const genresEnjoy: string[] = answers["genres_enjoy"] ?? [];
  const enjoyDelta: TagProfile = {};
  for (const g of genresEnjoy) enjoyDelta[g] = WEIGHT.genre;
  deltas.push(enjoyDelta);
  // genres_avoid is now a HARD FILTER (see filters.avoidGenres below), not a soft down-weight —
  // a loosely-avoided genre no longer just gets outscored, it's excluded from the deck outright.

  const conflicts = detectGenreConflicts(answers);
  conflicts.forEach((conflict, i) => {
    const qId = `conflict_${i}_${conflict.avoidedGenre}`;
    const resolution = answers[qId];
    if (resolution) {
      deltas.push(resolveConflictDelta(conflict, resolution));
    }
  });

  if (answers["love_factor"]) deltas.push({ [answers["love_factor"]]: WEIGHT.loveFactor });
  if (answers["recency"]) deltas.push({ [answers["recency"]]: WEIGHT.recency });

  const industryPrefs: string[] = (answers["industry"] ?? []).filter((i: string) => i !== "no-preference");
  const industryDelta: TagProfile = {};
  for (const i of industryPrefs) industryDelta[i] = WEIGHT.industry;
  deltas.push(industryDelta);

  const favoriteTitles: string[] = (answers["favorite_titles"] ?? []).filter(Boolean);
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
        for (const tag of allTags) seedDelta[tag] = (seedDelta[tag] ?? 0) + WEIGHT.favoriteSeed;
        deltas.push(seedDelta);
      }
    }
  }

  const platforms: Platform[] = answers["platforms"] ?? [];
  const languages: Language[] = answers["languages"] ?? [];
  const avoidGenres = computeAvoidGenreFilter(answers);
  const lengthPreference = mapLengthCommitment(answers["length_commitment"]);
  const type = mapTypeFilter(answers["type"]);
  const maxContentRating: ContentRating | undefined = answers["content_comfort"];

  return {
    tagProfile: mergeDeltas(...deltas),
    filters: {
      type,
      platforms,
      languages,
      avoidGenres,
      lengthPreference,
      maxContentRating,
      excludeIntensity: excludeIntensity.length > 0 ? excludeIntensity : undefined,
    },
  };
}

/** Q1's answer is a hard filter on title.type, not just a picker for the type-specific
 * follow-up question below — "surprise" (or no answer) means don't filter at all. */
export function mapTypeFilter(value: string | undefined): HardFilters["type"] {
  if (value === "movie" || value === "show" || value === "anime") return value;
  return undefined;
}

export function mapLengthCommitment(value: string | undefined): HardFilters["lengthPreference"] {
  if (value === "single-sitting") return "single-sitting";
  if (value === "short-binge") return "short-binge";
  if (value === "multi-season") return "multi-season";
  if (value === "no-cap") return "no-cap";
  return undefined;
}
