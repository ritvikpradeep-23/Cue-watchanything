/**
 * ============================================================================
 *  SYNTHETIC TEST DATA — seeds fake users + fake swipes to validate the
 *  Learned Weight Tuning pipeline (cue-ml-weight-tuning-spec-Main.md) before
 *  real usage clears its MIN_INTERACTIONS = 500 threshold.
 *
 *  One-time dev/testing script. Run manually — never wired into the app,
 *  never scheduled (see server/vercel.json's `crons`, which this is NOT in).
 *
 *  Every row this script creates is marked:
 *    - User.isSynthetic = true
 *    - User.discoverable = false, User.username = null — so these accounts
 *      can never surface in Taste Twins/friend search/social features and
 *      no real user can ever encounter one.
 *  runWeightTraining() (src/lib/trainWeights.ts) EXCLUDES isSynthetic users
 *  by default, so this data can never silently bias production weights even
 *  if scripts/cleanup-synthetic-swipes.ts is never run. That cleanup script
 *  is still the way to actually remove these rows once real usage takes over.
 *
 *  This project has no separate dev/staging database (see CLAUDE.md — Neon,
 *  same DATABASE_URL as production, by design). If you're seeing this
 *  comment because you're about to run this script, you are about to write
 *  synthetic users + swipes into the SAME DATABASE real users are on. The
 *  safeguards above (isSynthetic flag, non-discoverable, excluded from
 *  training by default) exist specifically because of that — but you should
 *  still only run this deliberately, and clean it up once it's served its
 *  purpose.
 *
 *  Run with: npx tsx scripts/seed-synthetic-swipes.ts
 *  Then validate the pipeline against it with:
 *    npx tsx scripts/train-weights.ts --include-synthetic
 *  Clean up when done with: npx tsx scripts/cleanup-synthetic-swipes.ts --delete
 * ============================================================================
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import {
  GENRES,
  MOODS,
  PACES,
  TONES,
  INDUSTRIES,
  RECENCIES,
  LENGTH_BUCKETS,
  scoreTitle,
  passesHardFilters,
  type TagProfile,
  type HardFilters,
  type TitleSeed,
  type TitleTags,
  type Genre,
} from "@watch-recommender/shared";

const NUM_SYNTHETIC_USERS = 45;
// ~31 swipes/user average x 45 users ≈ 1400 — comfortably clears the spec's
// MIN_INTERACTIONS = 500 with plenty left for the 80/20 validation split.
const SWIPES_PER_USER_MIN = 28;
const SWIPES_PER_USER_MAX = 34;
// Fraction of each user's swipes drawn from titles that actually score > 0
// against their profile (the rest come from non-matching titles) — keeps a
// real mix of likes and passes instead of an almost-all-likes deck.
const RELEVANT_SHARE = 0.55;
// Consistency band: 70-80% of swipes follow the profile's true preference,
// the rest are flipped — see rationale in generateUser() below.
const CONSISTENCY_MIN = 0.7;
const CONSISTENCY_MAX = 0.8;
const SUPER_LIKE_CHANCE = 0.15;
const SPREAD_DAYS = 30;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

interface SyntheticProfile {
  tagProfile: TagProfile;
  filters: HardFilters;
  consistency: number;
}

/**
 * Builds a randomized-but-internally-consistent taste profile: a genuine lean
 * toward a small handful of tags (2 genres, a mood, a pace, a tone, an
 * industry, sometimes a recency/length preference), plus one avoided genre —
 * not uniform noise across the whole taxonomy. Weight magnitudes are picked
 * to sit in the same range the real onboarding quiz produces (see WEIGHT in
 * shared/src/quiz/onboarding.ts), not arbitrary.
 */
function generateProfile(): SyntheticProfile {
  const [likedGenreA, likedGenreB] = pickN(GENRES, 2);
  const remainingGenres = GENRES.filter((g) => g !== likedGenreA && g !== likedGenreB);
  const avoidedGenre = pick(remainingGenres) as Genre;

  const tagProfile: TagProfile = {
    [likedGenreA]: randFloat(6, 9),
    [likedGenreB]: randFloat(4, 7),
    [pick(MOODS)]: randFloat(3, 6),
    [pick(PACES)]: randFloat(2, 4),
    [pick(TONES)]: randFloat(2, 4),
    [pick(INDUSTRIES)]: randFloat(2, 4),
  };
  // Only some profiles bother having an opinion on recency/length — real users vary in how
  // many questions produce a strong signal, not every category is always populated.
  if (Math.random() < 0.5) tagProfile[pick(RECENCIES)] = randFloat(1, 3);
  if (Math.random() < 0.5) tagProfile[pick(LENGTH_BUCKETS)] = randFloat(1, 3);

  const filters: HardFilters = { avoidGenres: [avoidedGenre] };
  // About half the synthetic users have a type preference, mirroring real quiz behavior where
  // "surprise me" is one option among several.
  if (Math.random() < 0.5) {
    filters.type = pick(["movie", "show", "anime"] as const);
  }

  return { tagProfile, filters, consistency: randFloat(CONSISTENCY_MIN, CONSISTENCY_MAX) };
}

interface CatalogTitle {
  id: string;
  seed: TitleSeed;
}

async function loadCatalog(): Promise<CatalogTitle[]> {
  const rows = await prisma.title.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      plotSummary: true,
      cast: true,
      seasons: true,
      episodes: true,
      runtimeMinutes: true,
      releaseYear: true,
      platforms: true,
      languages: true,
      posterUrl: true,
      tags: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    seed: {
      id: r.id,
      name: r.name,
      type: r.type,
      plot_summary: r.plotSummary,
      cast: JSON.parse(r.cast || "[]"),
      seasons: r.seasons,
      episodes: r.episodes,
      runtime_minutes: r.runtimeMinutes,
      release_year: r.releaseYear,
      platforms: JSON.parse(r.platforms || "[]"),
      languages: JSON.parse(r.languages || "[]"),
      poster_url: r.posterUrl,
      tags: JSON.parse(r.tags) as TitleTags,
    },
  }));
}

interface SimulatedSwipe {
  titleId: string;
  action: "pass" | "like" | "super_like";
  createdAt: Date;
}

/**
 * Simulates one synthetic user's swipe history against the real catalog.
 * Picks a mixed pool of matching and non-matching titles (by real scoreTitle
 * score against this profile, respecting the same hard filters buildDeck
 * would apply), assigns each its "true" label from that match, then flips a
 * noise fraction of labels — a perfectly clean signal would just teach the
 * model its own simulation rules back rather than exercising anything real.
 */
function simulateSwipes(profile: SyntheticProfile, catalog: CatalogTitle[]): SimulatedSwipe[] {
  const candidates = catalog.filter((c) => passesHardFilters(c.seed, profile.filters));
  const scored = candidates.map((c) => ({ ...c, score: scoreTitle(profile.tagProfile, c.seed) }));

  const relevant = shuffle(scored.filter((c) => c.score > 0));
  const other = shuffle(scored.filter((c) => c.score <= 0));

  const targetTotal = randInt(SWIPES_PER_USER_MIN, SWIPES_PER_USER_MAX);
  const targetRelevant = Math.min(relevant.length, Math.round(targetTotal * RELEVANT_SHARE));
  const targetOther = Math.min(other.length, targetTotal - targetRelevant);

  const chosen = [
    ...relevant.slice(0, targetRelevant).map((c) => ({ ...c, trueLabel: "like" as const })),
    ...other.slice(0, targetOther).map((c) => ({ ...c, trueLabel: "pass" as const })),
  ];

  const relevantScores = relevant.slice(0, targetRelevant).map((c) => c.score).sort((a, b) => a - b);
  const superLikeThreshold = relevantScores[Math.floor(relevantScores.length * (2 / 3))] ?? Infinity;

  return chosen.map((c) => {
    const noisy = Math.random() >= profile.consistency;
    let action: "pass" | "like" = noisy ? (c.trueLabel === "like" ? "pass" : "like") : c.trueLabel;
    let finalAction: "pass" | "like" | "super_like" = action;
    if (finalAction === "like" && c.score >= superLikeThreshold && Math.random() < SUPER_LIKE_CHANCE) {
      finalAction = "super_like";
    }
    const daysAgo = randInt(0, SPREAD_DAYS);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - randInt(0, 86400) * 1000);
    return { titleId: c.id, action: finalAction, createdAt };
  });
}

async function main() {
  console.log("=== SYNTHETIC SWIPE SEEDING (test data for Learned Weight Tuning) ===");
  console.log(`Target: ${NUM_SYNTHETIC_USERS} synthetic users, ~${SWIPES_PER_USER_MIN}-${SWIPES_PER_USER_MAX} swipes each.\n`);

  const catalog = await loadCatalog();
  console.log(`Loaded ${catalog.length} real titles to swipe against.`);
  if (catalog.length === 0) {
    console.error("No titles in the catalog — seed the title dataset first.");
    process.exitCode = 1;
    return;
  }

  // Shared placeholder password — these accounts are never meant to be logged into; a random
  // hash per user would be pure wasted bcrypt work for no security benefit here.
  const passwordHash = await hashPassword(`synthetic-${Date.now()}-${Math.random()}`);

  let totalInteractions = 0;
  const actionCounts = { pass: 0, like: 0, super_like: 0 };
  const allSwipeRows: { userId: string; titleId: string; action: "pass" | "like" | "super_like"; createdAt: Date }[] = [];

  for (let i = 0; i < NUM_SYNTHETIC_USERS; i++) {
    const profile = generateProfile();

    const user = await prisma.user.create({
      data: {
        email: `synthetic-swipe-test-${Date.now()}-${i}@cue-synthetic.invalid`,
        passwordHash,
        isSynthetic: true,
        discoverable: false, // never surfaces in Taste Twins / friend search
      },
    });

    await prisma.quizResponse.create({
      data: {
        userId: user.id,
        kind: "onboarding",
        answers: "{}", // synthetic — no real quiz was taken, only the resulting profile matters
        resultingTagProfile: JSON.stringify({ tagProfile: profile.tagProfile, filters: profile.filters }),
      },
    });

    const swipes = simulateSwipes(profile, catalog);
    for (const s of swipes) {
      allSwipeRows.push({ userId: user.id, titleId: s.titleId, action: s.action, createdAt: s.createdAt });
      actionCounts[s.action]++;
    }
    totalInteractions += swipes.length;

    if ((i + 1) % 10 === 0 || i === NUM_SYNTHETIC_USERS - 1) {
      console.log(`  [${i + 1}/${NUM_SYNTHETIC_USERS}] users created, ${totalInteractions} interactions simulated so far...`);
    }
  }

  const WRITE_BATCH = 500;
  for (let i = 0; i < allSwipeRows.length; i += WRITE_BATCH) {
    const batch = allSwipeRows.slice(i, i + WRITE_BATCH);
    await prisma.userTitleAction.createMany({ data: batch });
  }

  console.log("\n=== DONE — SYNTHETIC TEST DATA ===");
  console.log(`Synthetic users created: ${NUM_SYNTHETIC_USERS} (all User.isSynthetic = true)`);
  console.log(`Total interactions: ${totalInteractions}`);
  console.log(`  pass: ${actionCounts.pass}, like: ${actionCounts.like}, super_like: ${actionCounts.super_like}`);
  console.log(
    totalInteractions >= 500
      ? `Clears MIN_INTERACTIONS = 500 from cue-ml-weight-tuning-spec-Main.md.`
      : `WARNING: below the 500-interaction minimum — increase NUM_SYNTHETIC_USERS and rerun.`,
  );
  console.log("\nNext steps:");
  console.log("  npx tsx scripts/train-weights.ts --include-synthetic --dry-run   # validate the pipeline (safe — never promotes to live scoring)");
  console.log("  npx tsx scripts/cleanup-synthetic-swipes.ts            # dry-run report of synthetic rows");
  console.log("  npx tsx scripts/cleanup-synthetic-swipes.ts --delete   # actually remove them when done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
