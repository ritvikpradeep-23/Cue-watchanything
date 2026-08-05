import { describe, expect, it } from "vitest";
import type { TitleSeed } from "@watch-recommender/shared";
import {
  scoreTitle,
  buildDeck,
  buildTop3,
  applyDelta,
  mergeDeltas,
  generateTagCheckQuestions,
} from "@watch-recommender/shared";

function makeTitle(overrides: Partial<TitleSeed> & { id: string }): TitleSeed {
  return {
    name: overrides.id,
    type: "show",
    plot_summary: "A story.",
    cast: ["Actor One"],
    seasons: 1,
    episodes: 8,
    runtime_minutes: null,
    release_year: 2020,
    platforms: ["Netflix"],
    poster_url: "/posters/placeholder.jpg",
    tags: {
      genre: [],
      mood: [],
      pace: [],
      tone: [],
      cast_style: [],
      content_rating: ["teen"],
      intensity: [],
      era_setting: ["modern"],
      structure: ["serialized"],
      sub_dub: [],
      completion_status: ["completed"],
      recency: ["classic"],
      length_bucket: ["short-binge"],
      love_factor: ["characters"],
    },
    ...overrides,
  };
}

describe("scoreTitle", () => {
  it("sums the user's weight for every tag the title carries", () => {
    const title = makeTitle({
      id: "t1",
      tags: {
        ...makeTitle({ id: "t1" }).tags,
        genre: ["comedy", "drama"],
        mood: ["funny-witty"],
      },
    });
    const profile = { comedy: 3, drama: 1, "funny-witty": 2, horror: -5 };
    expect(scoreTitle(profile, title)).toBeCloseTo(3 + 1 + 2 + 0 /* content_rating/etc default 0 */);
  });

  it("defaults absent tags to 0 weight", () => {
    const title = makeTitle({ id: "t1", tags: { ...makeTitle({ id: "t1" }).tags, genre: ["horror"] } });
    expect(scoreTitle({}, title)).toBe(0);
  });
});

describe("buildDeck", () => {
  const titles = [
    makeTitle({ id: "a", platforms: ["Netflix"], tags: { ...makeTitle({ id: "a" }).tags, genre: ["comedy"] } }),
    makeTitle({ id: "b", platforms: ["Hulu"], tags: { ...makeTitle({ id: "b" }).tags, genre: ["drama"] } }),
    makeTitle({
      id: "c",
      platforms: ["Netflix"],
      tags: { ...makeTitle({ id: "c" }).tags, genre: ["comedy"], length_bucket: ["long-runner"] },
    }),
  ];

  it("filters titles to those intersecting the user's platforms", () => {
    const deck = buildDeck({ comedy: 1, drama: 1 }, titles, { filters: { platforms: ["Netflix"] } });
    expect(deck.map((t) => t.id).sort()).toEqual(["a", "c"]);
  });

  it("excludes long-runner titles when length preference is single-sitting", () => {
    const deck = buildDeck(
      { comedy: 1 },
      titles,
      { filters: { platforms: ["Netflix"], lengthPreference: "single-sitting" } },
    );
    expect(deck.map((t) => t.id)).toEqual(["a"]);
  });

  it("excludes already-actioned titles", () => {
    const deck = buildDeck({ comedy: 1, drama: 1 }, titles, { excludedIds: new Set(["a"]) });
    expect(deck.find((t) => t.id === "a")).toBeUndefined();
  });

  it("sorts by score descending", () => {
    const deck = buildDeck({ comedy: 5, drama: 1 }, titles);
    expect(deck.map((t) => t.id).slice(0, 2).sort()).toEqual(["a", "c"]);
  });
});

describe("buildTop3", () => {
  function tagged(id: string, extra: Partial<TitleSeed["tags"]>): TitleSeed {
    const base = makeTitle({ id });
    return makeTitle({ id, tags: { ...base.tags, ...extra } });
  }

  const titles = [
    tagged("high", { genre: ["comedy"], mood: ["funny-witty"] }),
    tagged("mid", { genre: ["comedy"] }),
    tagged("low", { genre: ["drama"] }),
    tagged("diverse", { genre: ["horror"], mood: ["dark"], love_factor: ["world-building"] }),
  ];

  it("returns exactly 3 picks with the top scorer first when no tie exists", () => {
    const profile = { comedy: 5, "funny-witty": 5, drama: 1, horror: 0.5 };
    const result = buildTop3(profile, titles, { exploreExploitDial: 0.1 });
    expect(result.pendingTieBreak).toBeNull();
    expect(result.picks).toHaveLength(3);
    expect(result.picks[0].id).toBe("high");
  });

  it("swaps in a tag-diverse title when the explore/exploit dial leans toward exploring", () => {
    const profile = { comedy: 5, "funny-witty": 5, drama: 1, horror: 0.5, dark: 0.5 };
    const result = buildTop3(profile, titles, { exploreExploitDial: 0.9 });
    expect(result.picks.map((t) => t.id)).toContain("diverse");
  });

  it("excludes already-watched/excluded titles", () => {
    const profile = { comedy: 5, "funny-witty": 5 };
    const result = buildTop3(profile, titles, { excludedIds: new Set(["high"]) });
    expect(result.picks.find((t) => t.id === "high")).toBeUndefined();
  });

  // Tie-break fires at the #3-vs-#4 cutoff (per spec: "the cutoff point where only one
  // can make the top 3"), not between #2 and #3 — so a tie needs a 4th close contender.
  it("fires a tie-break question when the #3 and #4 candidates are within threshold", () => {
    const closeTitles = [
      tagged("winner", { genre: ["comedy"] }),
      tagged("second", { genre: ["action"] }),
      tagged("third", { genre: ["drama"], mood: ["dark"] }),
      tagged("fourth", { genre: ["romance"], mood: ["feel-good"] }),
    ];
    const profile = { comedy: 10, action: 5, drama: 3.0, romance: 2.95 };
    const result = buildTop3(profile, closeTitles, { exploreExploitDial: 0.1, tieThreshold: 0.05 });
    expect(result.pendingTieBreak).not.toBeNull();
    expect(result.picks).toHaveLength(0);
  });

  it("resolves the tie once a winner id is supplied", () => {
    const closeTitles = [
      tagged("winner", { genre: ["comedy"] }),
      tagged("second", { genre: ["action"] }),
      tagged("third", { genre: ["drama"], mood: ["dark"] }),
      tagged("fourth", { genre: ["romance"], mood: ["feel-good"] }),
    ];
    const profile = { comedy: 10, action: 5, drama: 3.0, romance: 2.95 };
    const result = buildTop3(profile, closeTitles, {
      exploreExploitDial: 0.1,
      tieThreshold: 0.05,
      tieBreakWinnerId: "fourth",
    });
    expect(result.pendingTieBreak).toBeNull();
    expect(result.picks.map((t) => t.id)).toContain("fourth");
  });
});

describe("delta helpers", () => {
  it("applyDelta never mutates the base profile", () => {
    const base = { comedy: 1 };
    const next = applyDelta(base, { comedy: 2, drama: 1 });
    expect(base).toEqual({ comedy: 1 });
    expect(next).toEqual({ comedy: 3, drama: 1 });
  });

  it("mergeDeltas sums overlapping tags across multiple deltas", () => {
    const merged = mergeDeltas({ comedy: 1 }, { comedy: 2, drama: -1 });
    expect(merged).toEqual({ comedy: 3, drama: -1 });
  });
});

describe("generateTagCheckQuestions", () => {
  it("generates one question per top-2 defining tag categories present on the title", () => {
    const title = makeTitle({
      id: "t1",
      tags: { ...makeTitle({ id: "t1" }).tags, pace: ["slow-burn"], mood: ["dark"] },
    });
    const questions = generateTagCheckQuestions(title);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(2);
    expect(questions.some((q) => q.category === "pace")).toBe(true);
  });
});
