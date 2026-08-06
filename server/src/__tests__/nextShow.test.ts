import { describe, expect, it } from "vitest";
import { TITLES } from "../../prisma/seed-data/titles";
import { getNextNextShowQuestion, submitNextShow, computeNextShowDelta, NextShowContext } from "@watch-recommender/shared";
import type { Answers } from "@watch-recommender/shared";

const watchedTitle = TITLES.find((t) => t.id === "breaking-bad")!;

function baseCtx(overrides: Partial<NextShowContext> = {}): NextShowContext {
  return {
    baseProfile: { drama: 5, thriller: 3 },
    baseFilters: {},
    watchedTitle,
    allTitles: TITLES,
    excludedIds: new Set(),
    ...overrides,
  };
}

function answerFull(ctx: NextShowContext, overrides: Answers = {}) {
  const answers: Answers = {};
  let guard = 0;
  while (guard++ < 25) {
    const q = getNextNextShowQuestion(answers, ctx);
    if (!q) break;
    if (q.id in overrides) {
      answers[q.id] = overrides[q.id];
      continue;
    }
    if (q.kind === "single") answers[q.id] = q.options![0].value;
    else if (q.kind === "multi") answers[q.id] = [];
    else if (q.kind === "text") answers[q.id] = [];
  }
  return answers;
}

describe("getNextNextShowQuestion", () => {
  it("starts with finished_status", () => {
    const q = getNextNextShowQuestion({}, baseCtx());
    expect(q?.id).toBe("finished_status");
  });

  it("asks dropped_reason only when finished_status is dropped", () => {
    const answers: Answers = { finished_status: "finished" };
    const q = getNextNextShowQuestion(answers, baseCtx());
    expect(q?.id).not.toBe("dropped_reason");

    const answers2: Answers = { finished_status: "dropped" };
    const q2 = getNextNextShowQuestion(answers2, baseCtx());
    expect(q2?.id).toBe("dropped_reason");
  });

  it("auto-generates two tag-check questions from the watched title's own tags", () => {
    let answers: Answers = { finished_status: "finished", rating: "4" };
    const q1 = getNextNextShowQuestion(answers, baseCtx());
    expect(q1?.id).toBe("tag_check_0");
    answers = { ...answers, [q1!.id]: q1!.options![0].value };
    const q2 = getNextNextShowQuestion(answers, baseCtx());
    expect(q2?.id).toBe("tag_check_1");
  });

  it("never re-asks onboarding-only questions like cast_style or content_comfort", () => {
    const answers = answerFull(baseCtx());
    expect("cast_style" in answers).toBe(false);
    expect("content_comfort" in answers).toBe(false);
    expect("setting" in answers).toBe(false);
  });

  it("terminates with confidence_check as the final question when there's no tie", () => {
    const answers = answerFull(baseCtx());
    expect("confidence_check" in answers).toBe(true);
    expect(getNextNextShowQuestion(answers, baseCtx())).toBeNull();
  });
});

describe("computeNextShowDelta", () => {
  it("down-weights slow-burn when the drop reason is 'too-slow'", () => {
    const answers: Answers = { finished_status: "dropped", dropped_reason: "too-slow" };
    const delta = computeNextShowDelta(answers, watchedTitle, TITLES);
    expect(delta["slow-burn"]).toBeLessThan(0);
  });

  it("scales the watched title's own tags positively for a high rating", () => {
    const answers: Answers = { rating: "5" };
    const delta = computeNextShowDelta(answers, watchedTitle, TITLES);
    expect(delta["drama"]).toBeGreaterThan(0);
  });

  it("scales the watched title's own tags negatively for a low rating", () => {
    const answers: Answers = { rating: "1" };
    const delta = computeNextShowDelta(answers, watchedTitle, TITLES);
    expect(delta["drama"]).toBeLessThan(0);
  });
});

describe("submitNextShow", () => {
  it("returns exactly 3 picks excluding the watched title", () => {
    const ctx = baseCtx();
    const answers = answerFull(ctx);
    const result = submitNextShow(answers, ctx);
    expect(result.picks).toHaveLength(3);
    expect(result.picks.find((p) => p.id === watchedTitle.id)).toBeUndefined();
  });

  it("sets swappable true only when confidence_check is 'swappable'", () => {
    const ctx = baseCtx();
    const answers = answerFull(ctx, { confidence_check: "swappable" });
    const result = submitNextShow(answers, ctx);
    expect(result.swappable).toBe(true);
  });
});
