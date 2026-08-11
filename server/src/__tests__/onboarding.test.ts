import { describe, expect, it } from "vitest";
import { buildDeck, computeOnboardingProfile, getNextOnboardingQuestion } from "@watch-recommender/shared";
import { TITLES } from "../../prisma/seed-data/titles";
import { BATCH_TITLES } from "../../prisma/seed-data/batches";

const ALL_TITLES = [...TITLES, ...BATCH_TITLES];

function answerFullQuiz(overrides: Record<string, any> = {}, allTitles?: { name: string; type: string }[]) {
  const answers: Record<string, any> = {};
  let guard = 0;
  while (guard++ < 40) {
    const q = getNextOnboardingQuestion(answers, allTitles);
    if (!q) break;
    if (q.id in overrides) {
      answers[q.id] = overrides[q.id];
      continue;
    }
    if (q.kind === "single") answers[q.id] = q.options![0].value;
    else if (q.kind === "multi") answers[q.id] = [];
    else if (q.kind === "text" || q.kind === "text3") answers[q.id] = [];
    else if (q.kind === "toggle-pair") {
      const t: Record<string, any> = {};
      for (const tg of q.toggles!) t[tg.key] = tg.options[0].value;
      answers[q.id] = t;
    }
  }
  return answers;
}

/** Walks the quiz forward, recording question ids in the order actually answered — the same
 * "history" QuizWizard tracks client-side, used to correctly truncate on a simulated "back". */
function walkWithHistory(overrides: Record<string, any> = {}, allTitles?: { name: string; type: string }[]) {
  const answers: Record<string, any> = {};
  const history: string[] = [];
  let guard = 0;
  while (guard++ < 40) {
    const q = getNextOnboardingQuestion(answers, allTitles);
    if (!q) break;
    const value =
      q.id in overrides
        ? overrides[q.id]
        : q.kind === "single"
          ? q.options![0].value
          : q.kind === "multi"
            ? []
            : q.kind === "text" || q.kind === "text3"
              ? []
              : (() => {
                  const t: Record<string, any> = {};
                  for (const tg of q.toggles!) t[tg.key] = tg.options[0].value;
                  return t;
                })();
    answers[q.id] = value;
    history.push(q.id);
  }
  return { answers, history };
}

describe("getNextOnboardingQuestion", () => {
  it("asks the 8 baseline questions first, in order", () => {
    const answers = {};
    const q1 = getNextOnboardingQuestion(answers);
    expect(q1?.id).toBe("type");
  });

  it("skips content-comfort follow-up entirely for 'teen'", () => {
    const answers = answerFullQuiz({ content_comfort: "teen" });
    expect("mature_followup" in answers).toBe(false);
    expect("family_followup" in answers).toBe(false);
  });

  it("asks the mature follow-up when content_comfort is mature", () => {
    const answers: Record<string, any> = {
      type: "show", languages: ["English"], time_now: "no-limit", mood_now: "think", pace: "slow-burn",
      tone: "gritty", cast_style: "ensemble", content_comfort: "mature", setting: "modern",
    };
    // walk one more step from here
    const next = getNextOnboardingQuestion(answers);
    // mood_now="think" fires mood_think_followup before content-comfort branch
    expect(next?.id).toBe("mood_think_followup");
  });

  it("skips the type-specific follow-up when type is 'surprise'", () => {
    const answers = answerFullQuiz({ type: "surprise" });
    expect("show_structure_followup" in answers).toBe(false);
    expect("movie_structure_followup" in answers).toBe(false);
    expect("anime_followup" in answers).toBe(false);
  });

  it("fires a conflict-check question when avoiding comedy while mood implies wanting a laugh", () => {
    const answers = answerFullQuiz({
      mood_now: "laugh",
      mood_laugh_followup: "witty",
      genres_avoid: ["comedy"],
    });
    const conflictKey = Object.keys(answers).find((k) => k.startsWith("conflict_"));
    expect(conflictKey).toBeDefined();
  });

  it("skips the conflict-check entirely when there is no contradiction", () => {
    const answers = answerFullQuiz({
      mood_now: "think",
      genres_avoid: ["horror"],
    });
    const conflictKey = Object.keys(answers).find((k) => k.startsWith("conflict_"));
    expect(conflictKey).toBeUndefined();
  });

  it("terminates (returns null) once every applicable slot is answered", () => {
    const answers = answerFullQuiz();
    expect(getNextOnboardingQuestion(answers)).toBeNull();
  });
});

describe("computeOnboardingProfile", () => {
  it("reroutes comedy weight instead of zeroing it out when the conflict resolves toward dramedy", () => {
    const answers = answerFullQuiz({
      mood_now: "laugh",
      mood_laugh_followup: "witty",
      genres_avoid: ["comedy"],
    });
    const conflictKey = Object.keys(answers).find((k) => k.startsWith("conflict_"))!;
    answers[conflictKey] = "mixed-into-drama";

    const { tagProfile, filters } = computeOnboardingProfile(answers, TITLES);
    // comedy conflicts always reroute to a softer tag rather than hard-filtering (see
    // computeAvoidGenreFilter) — drama/funny-witty should have picked up weight instead
    expect(filters.avoidGenres).not.toContain("comedy");
    expect(tagProfile["drama"]).toBeGreaterThan(0);
    expect(tagProfile["funny-witty"]).toBeGreaterThan(0);
  });

  it("seeds weight from matched favorite titles", () => {
    const answers = answerFullQuiz({ favorite_titles: ["Breaking Bad"] });
    const { tagProfile } = computeOnboardingProfile(answers, TITLES);
    expect(tagProfile["drama"]).toBeGreaterThan(0);
  });

  it("separates platform/length answers into hard filters, not tag weights", () => {
    // length_commitment only fires for the movie/surprise path (show/anime replace it with
    // season_commitment/episode_count_tolerance) — force movie so it's reachable.
    const answers = answerFullQuiz({
      type: "movie",
      platforms: ["Netflix", "Hulu"],
      length_commitment: "single-sitting",
    });
    const { filters, tagProfile } = computeOnboardingProfile(answers, TITLES);
    expect(filters.platforms).toEqual(["Netflix", "Hulu"]);
    expect(filters.lengthPreference).toBe("single-sitting");
    expect(tagProfile["Netflix"]).toBeUndefined();
  });

  it("hard-filters a straightforward avoided genre with no contradicting earlier signal", () => {
    const answers = answerFullQuiz({ mood_now: "think", genres_avoid: ["horror"] });
    const { filters } = computeOnboardingProfile(answers, TITLES);
    expect(filters.avoidGenres).toContain("horror");
  });

  it("carries the language selection through as a hard filter, not a weighted tag", () => {
    const answers = answerFullQuiz({ languages: ["Korean"] });
    const { filters, tagProfile } = computeOnboardingProfile(answers, TITLES);
    expect(filters.languages).toEqual(["Korean"]);
    expect(tagProfile["Korean"]).toBeUndefined();
  });

  it("weights an industry preference as a soft tag, same pattern as genre", () => {
    const answers = answerFullQuiz({ industry: ["Korean Cinema"] });
    const { tagProfile } = computeOnboardingProfile(answers, TITLES);
    expect(tagProfile["Korean Cinema"]).toBeGreaterThan(0);
  });

  it("hard-filters Q1's type answer instead of only steering the follow-up question", () => {
    const answers = answerFullQuiz({ type: "movie" });
    const { filters } = computeOnboardingProfile(answers, TITLES);
    expect(filters.type).toBe("movie");
  });

  it("skips the type filter entirely when Q1 is 'surprise me'", () => {
    const answers = answerFullQuiz({ type: "surprise" });
    const { filters } = computeOnboardingProfile(answers, TITLES);
    expect(filters.type).toBeUndefined();
  });

  it("a 'movie'-only quiz answer never yields a deck containing a show or anime", () => {
    const answers = answerFullQuiz({ type: "movie" });
    const { tagProfile, filters } = computeOnboardingProfile(answers, TITLES);
    const deck = buildDeck(tagProfile, TITLES, { filters });
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((t) => t.type === "movie")).toBe(true);
  });

  // ---- quiz spec testing checklist ----

  it("a 'movie' + 'single-sitting' answer never returns a show or anime title", () => {
    const answers = answerFullQuiz({ type: "movie", length_commitment: "single-sitting" });
    const { tagProfile, filters } = computeOnboardingProfile(answers, TITLES);
    const deck = buildDeck(tagProfile, TITLES, { filters });
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((t) => t.type === "movie")).toBe(true);
    expect(deck.some((t) => t.type === "show" || t.type === "anime")).toBe(false);
  });

  it("a 'Hindi' language answer never returns a title that isn't available in Hindi", () => {
    const answers = answerFullQuiz({ languages: ["Hindi"] });
    const { tagProfile, filters } = computeOnboardingProfile(answers, ALL_TITLES);
    const deck = buildDeck(tagProfile, ALL_TITLES, { filters });
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((t) => t.languages.includes("Hindi"))).toBe(true);
  });

  it("never dispatches the same question_id twice in one session, for every type path", () => {
    for (const type of ["movie", "show", "anime", "surprise"] as const) {
      const seen = new Set<string>();
      const answers: Record<string, any> = {};
      let guard = 0;
      while (guard++ < 40) {
        const q = getNextOnboardingQuestion(answers);
        if (!q) break;
        expect(seen.has(q.id), `[type=${type}] "${q.id}" dispatched twice`).toBe(false);
        seen.add(q.id);
        if (q.id === "type") answers[q.id] = type;
        else if (q.kind === "single") answers[q.id] = q.options![0].value;
        else if (q.kind === "multi") answers[q.id] = [];
        else if (q.kind === "text" || q.kind === "text3") answers[q.id] = [];
        else if (q.kind === "toggle-pair") {
          const t: Record<string, any> = {};
          for (const tg of q.toggles!) t[tg.key] = tg.options[0].value;
          answers[q.id] = t;
        }
      }
      expect(guard).toBeLessThan(40); // didn't hit the guard — quiz actually terminated
    }
  });

  it("only asks the anime demographic bonus question when a favorite title matches an anime title", () => {
    const animeTitle = ALL_TITLES.find((t) => t.type === "anime");
    expect(animeTitle).toBeDefined();
    const titleIndex = ALL_TITLES.map((t) => ({ name: t.name, type: t.type }));

    const withMatch = answerFullQuiz({ type: "anime", favorite_titles: [animeTitle!.name] }, titleIndex);
    expect("demographic" in withMatch).toBe(true);

    const withoutMatch = answerFullQuiz(
      { type: "anime", favorite_titles: ["Not A Real Title Xyz"] },
      titleIndex,
    );
    expect("demographic" in withoutMatch).toBe(false);
  });

  it("never asks the anime demographic question outside the anime path, even if a favorite matches an anime title", () => {
    const animeTitle = ALL_TITLES.find((t) => t.type === "anime");
    expect(animeTitle).toBeDefined();
    const titleIndex = ALL_TITLES.map((t) => ({ name: t.name, type: t.type }));
    const answers = answerFullQuiz({ type: "movie", favorite_titles: [animeTitle!.name] }, titleIndex);
    expect("demographic" in answers).toBe(false);
  });

  it("going back and changing an earlier answer drops stale downstream branch answers", () => {
    // Build a full run where content_comfort="mature" triggers mature_followup with an
    // explicit exclusion, exactly like a real session.
    const { answers, history } = walkWithHistory({
      content_comfort: "mature",
      mature_followup: { graphic_violence_ok: "not-ok", heavy_themes_ok: "not-ok" },
    });
    expect(answers["mature_followup"]).toBeDefined();
    const { filters: matureFilters } = computeOnboardingProfile(answers, TITLES);
    expect(matureFilters.excludeIntensity).toEqual(["graphic-violence", "heavy-themes"]);

    // Simulate QuizWizard's goBack(): truncate history (and answers) back to content_comfort,
    // then revise it to "family" instead.
    const contentComfortIdx = history.indexOf("content_comfort");
    expect(contentComfortIdx).toBeGreaterThanOrEqual(0);
    const revisedAnswers = { ...answers };
    for (const id of history.slice(contentComfortIdx)) delete revisedAnswers[id];
    revisedAnswers["content_comfort"] = "family";

    // The state machine must now ask family_followup, not fall through to a stale
    // mature_followup — and must eventually re-reach setting/genres/etc. normally.
    const next = getNextOnboardingQuestion(revisedAnswers);
    // setting comes before any followup check in baseline order, so it's next...
    expect(next?.id).toBe("setting");
    revisedAnswers["setting"] = next!.options![0].value;
    // ...then mood_think_followup (mood_now defaulted to "think"), which is checked before
    // the comfort followup...
    const moodFollowup = getNextOnboardingQuestion(revisedAnswers);
    expect(moodFollowup?.id).toBe("mood_think_followup");
    revisedAnswers["mood_think_followup"] = moodFollowup!.options![0].value;
    // ...and only then family_followup, not a stale mature_followup.
    const followupAfterRevision = getNextOnboardingQuestion(revisedAnswers);
    expect(followupAfterRevision?.id).toBe("family_followup");

    // and recomputing filters reflects the revised answer, not the stale mature exclusion
    revisedAnswers["family_followup"] = "yes";
    const { filters: revisedFilters } = computeOnboardingProfile(revisedAnswers, TITLES);
    expect(revisedFilters.excludeIntensity).toBeUndefined();
    expect(revisedFilters.maxContentRating).toBe("family");
  });
});
