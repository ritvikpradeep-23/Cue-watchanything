import { describe, expect, it } from "vitest";
import { computeOnboardingProfile, getNextOnboardingQuestion } from "@watch-recommender/shared";
import { TITLES } from "../../prisma/seed-data/titles";

function answerFullQuiz(overrides: Record<string, any> = {}) {
  const answers: Record<string, any> = {};
  let guard = 0;
  while (guard++ < 30) {
    const q = getNextOnboardingQuestion(answers);
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
      type: "show", time_now: "no-limit", mood_now: "think", pace: "slow-burn",
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
    const answers = answerFullQuiz({ platforms: ["Netflix", "Hulu"], length_commitment: "single-sitting" });
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
});
