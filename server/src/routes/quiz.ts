import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { getAllTitleSeeds } from "../lib/titles";
import { computeOnboardingProfile, getNextOnboardingQuestion } from "../quiz/onboarding";

export const quizRouter = Router();

function parseAnswers(raw: unknown): Record<string, any> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

quizRouter.get("/next", (req, res) => {
  const answers = parseAnswers(req.query.answers);
  const question = getNextOnboardingQuestion(answers);
  res.json({ question });
});

quizRouter.post("/submit", requireAuth, async (req: AuthedRequest, res) => {
  const answers = req.body?.answers;
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers object is required" });
  }

  const { tagProfile, filters } = computeOnboardingProfile(answers, getAllTitleSeeds());

  await prisma.quizResponse.create({
    data: {
      userId: req.user!.userId,
      kind: "onboarding",
      answers: JSON.stringify(answers),
      resultingTagProfile: JSON.stringify({ tagProfile, filters }),
    },
  });

  res.json({ ok: true });
});
