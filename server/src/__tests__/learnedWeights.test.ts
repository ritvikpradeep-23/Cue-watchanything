import { describe, expect, it } from "vitest";
import {
  buildFeatureVector,
  derivePreferredTagPerCategory,
  FEATURE_CATEGORIES,
  scoreTitle,
  type TitleSeed,
} from "@watch-recommender/shared";
import { trainLogisticRegression, accuracy, predictProba } from "../lib/logisticRegression";

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
    languages: ["English"],
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
      industry: [],
    },
    ...overrides,
  };
}

describe("derivePreferredTagPerCategory", () => {
  it("picks the highest-weighted tag per category", () => {
    const preferred = derivePreferredTagPerCategory({ comedy: 3, drama: 1, "funny-witty": 2 });
    expect(preferred.genre).toBe("comedy");
    expect(preferred.mood).toBe("funny-witty");
  });

  it("ignores zero/negative weights — those aren't a preference", () => {
    const preferred = derivePreferredTagPerCategory({ comedy: -1, horror: 0 });
    expect(preferred.genre).toBeUndefined();
  });

  it("ignores tags with no known category", () => {
    const preferred = derivePreferredTagPerCategory({ "not-a-real-tag": 5 });
    expect(Object.keys(preferred)).toHaveLength(0);
  });
});

describe("buildFeatureVector", () => {
  const baseTags = makeTitle({ id: "t" }).tags;

  it("scores 1 when the title's tag matches the user's preferred value", () => {
    const vec = buildFeatureVector({
      preferredByCategory: { genre: "comedy" },
      avoidGenres: [],
      userLanguages: [],
      titleTags: { ...baseTags, genre: ["comedy", "drama"] },
      titleLanguages: ["English"],
    });
    expect(vec[FEATURE_CATEGORIES.indexOf("genre")]).toBe(1);
  });

  it("scores -1 when the title's genre is in the user's avoid list", () => {
    const vec = buildFeatureVector({
      preferredByCategory: {},
      avoidGenres: ["horror"],
      userLanguages: [],
      titleTags: { ...baseTags, genre: ["horror"] },
      titleLanguages: ["English"],
    });
    expect(vec[FEATURE_CATEGORIES.indexOf("genre")]).toBe(-1);
  });

  it("scores 0 when the category doesn't apply to this title", () => {
    const vec = buildFeatureVector({
      preferredByCategory: { runtime_bucket: "epic" },
      avoidGenres: [],
      userLanguages: [],
      titleTags: baseTags, // no runtime_bucket set (a show, not a movie)
      titleLanguages: ["English"],
    });
    expect(vec[FEATURE_CATEGORIES.indexOf("runtime_bucket")]).toBe(0);
  });

  it("season_commitment is always 0 — no backing title.tags field in this app", () => {
    const vec = buildFeatureVector({
      preferredByCategory: {},
      avoidGenres: [],
      userLanguages: [],
      titleTags: baseTags,
      titleLanguages: ["English"],
    });
    expect(vec[FEATURE_CATEGORIES.indexOf("season_commitment")]).toBe(0);
  });

  it("language matches via title.languages, not tags", () => {
    const vec = buildFeatureVector({
      preferredByCategory: {},
      avoidGenres: [],
      userLanguages: ["Hindi"],
      titleTags: baseTags,
      titleLanguages: ["Hindi", "English"],
    });
    expect(vec[FEATURE_CATEGORIES.indexOf("language")]).toBe(1);
  });
});

describe("scoreTitle with learnedWeights", () => {
  it("is a no-op (unchanged score) when learnedWeights is omitted", () => {
    const title = makeTitle({ id: "t", tags: { ...makeTitle({ id: "t" }).tags, genre: ["comedy"] } });
    const profile = { comedy: 4 };
    expect(scoreTitle(profile, title)).toBe(4);
    expect(scoreTitle(profile, title, undefined)).toBe(4);
  });

  it("scales a category's contribution by its learned multiplier", () => {
    const title = makeTitle({ id: "t", tags: { ...makeTitle({ id: "t" }).tags, genre: ["comedy"] } });
    const profile = { comedy: 4 };
    expect(scoreTitle(profile, title, { genre: 2 })).toBe(8);
    expect(scoreTitle(profile, title, { genre: 0.5 })).toBe(2);
  });

  it("categories with no learned weight default to multiplier 1", () => {
    const title = makeTitle({ id: "t", tags: { ...makeTitle({ id: "t" }).tags, mood: ["feel-good"] } });
    const profile = { "feel-good": 3 };
    expect(scoreTitle(profile, title, { genre: 5 })).toBe(3); // mood wasn't in the learned set
  });
});

describe("trainLogisticRegression", () => {
  it("learns a positive coefficient for a feature that perfectly predicts the positive class", () => {
    // feature[0] = 1 always co-occurs with label 1, feature[0] = -1 with label 0
    const X = [
      [1, 0],
      [1, 0],
      [-1, 0],
      [-1, 0],
      [1, 0],
      [-1, 0],
    ];
    const y = [1, 1, 0, 0, 1, 0];
    const model = trainLogisticRegression(X, y, { epochs: 500 });
    expect(model.coefficients[0]).toBeGreaterThan(0);
    expect(accuracy(X, y, model)).toBeGreaterThan(0.8);
  });

  it("predictProba returns a value between 0 and 1", () => {
    const model = trainLogisticRegression(
      [
        [1],
        [-1],
      ],
      [1, 0],
      { epochs: 200 },
    );
    const p = predictProba([1], model);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});
