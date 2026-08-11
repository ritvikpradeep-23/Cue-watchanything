import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { getAllTitleSeeds, getTitleSeedById, toApiTitle, toApiTitleFromSeed } from "../lib/titles";
import { getLatestTagProfile, getSwipedTitleIds } from "../lib/userProfile";
import { getActiveWeights } from "../lib/learnedWeights";
import {
  getNextNextShowQuestion,
  submitNextShow,
  computeNextShowDelta,
  NextShowContext,
  applyDelta,
  scoreTitle,
  passesHardFilters,
  generateTagCheckQuestions,
} from "@watch-recommender/shared";

export const nextShowRouter = Router();

function parseJson(raw: unknown): Record<string, any> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function buildContext(userId: string, watchedTitleId: string): Promise<NextShowContext | { error: string; status: number }> {
  const watchedTitle = await getTitleSeedById(watchedTitleId);
  if (!watchedTitle) return { error: "Watched title not found", status: 404 };

  const profile = await getLatestTagProfile(userId, "onboarding");
  if (!profile) return { error: "Complete the onboarding quiz first", status: 409 };

  const excludedIds = await getSwipedTitleIds(userId);
  const learnedWeights = await getActiveWeights();
  return {
    baseProfile: profile.tagProfile,
    baseFilters: profile.filters,
    watchedTitle,
    allTitles: await getAllTitleSeeds(),
    excludedIds,
    learnedWeights: learnedWeights ?? undefined,
  };
}

nextShowRouter.get("/quiz-context/:watchedTitleId", async (req, res) => {
  const title = await getTitleSeedById(String(req.params.watchedTitleId));
  if (!title) return res.status(404).json({ error: "Watched title not found" });
  res.json({ tagCheckQuestions: generateTagCheckQuestions(title) });
});

/** One-shot bundle so the client can run the whole 15-question branching flow locally, no round-trip per answer. */
nextShowRouter.get("/context/:watchedTitleId", requireAuth, async (req: AuthedRequest, res) => {
  const ctx = await buildContext(req.user!.userId, String(req.params.watchedTitleId));
  if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });

  res.json({
    baseProfile: ctx.baseProfile,
    baseFilters: ctx.baseFilters,
    watchedTitle: ctx.watchedTitle,
    allTitles: ctx.allTitles,
    excludedIds: [...ctx.excludedIds],
  });
});

nextShowRouter.get("/next", requireAuth, async (req: AuthedRequest, res) => {
  const watchedTitleId = req.query.watchedTitleId;
  if (typeof watchedTitleId !== "string") {
    return res.status(400).json({ error: "watchedTitleId is required" });
  }
  const ctx = await buildContext(req.user!.userId, watchedTitleId);
  if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });

  const answers = parseJson(req.query.answers);
  const question = getNextNextShowQuestion(answers, ctx);
  res.json({ question });
});

nextShowRouter.post("/submit", requireAuth, async (req: AuthedRequest, res) => {
  const { watchedTitleId, answers } = req.body ?? {};
  if (typeof watchedTitleId !== "string" || !answers || typeof answers !== "object") {
    return res.status(400).json({ error: "watchedTitleId and answers are required" });
  }
  const ctx = await buildContext(req.user!.userId, watchedTitleId);
  if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });

  const result = submitNextShow(answers, ctx);

  await prisma.quizResponse.create({
    data: {
      userId: req.user!.userId,
      kind: "next_show",
      answers: JSON.stringify(answers),
      resultingTagProfile: JSON.stringify({ tagProfile: result.sessionProfile }),
      watchedTitleId,
    },
  });

  res.json({
    picks: result.picks.map((t) => t.id),
    titles: result.picks.map(toApiTitleFromSeed),
    swappable: result.swappable,
  });
});

nextShowRouter.post("/swap", requireAuth, async (req: AuthedRequest, res) => {
  const { watchedTitleId, answers, keptTitleIds, swapOutTitleId } = req.body ?? {};
  if (
    typeof watchedTitleId !== "string" ||
    !answers ||
    typeof answers !== "object" ||
    !Array.isArray(keptTitleIds) ||
    typeof swapOutTitleId !== "string"
  ) {
    return res.status(400).json({ error: "watchedTitleId, answers, keptTitleIds, swapOutTitleId are required" });
  }

  const ctx = await buildContext(req.user!.userId, watchedTitleId);
  if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });

  const delta = computeNextShowDelta(answers, ctx.watchedTitle, ctx.allTitles);
  const sessionProfile = applyDelta(ctx.baseProfile, delta);

  const excluded = new Set([...ctx.excludedIds, watchedTitleId, swapOutTitleId, ...keptTitleIds]);
  const eligible = ctx.allTitles.filter((t) => !excluded.has(t.id) && passesHardFilters(t, ctx.baseFilters));
  const ranked = eligible
    .map((title) => ({ title, score: scoreTitle(sessionProfile, title) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return res.status(404).json({ error: "No eligible replacement found" });
  }

  res.json({ title: toApiTitle(await prisma.title.findUniqueOrThrow({ where: { id: ranked[0].title.id } })) });
});
