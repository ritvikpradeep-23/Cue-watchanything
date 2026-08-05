import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { getAllTitleSeeds, toApiTitleFromSeed } from "../lib/titles";
import { getLatestTagProfile, getSwipedTitleIds } from "../lib/userProfile";
import { buildDeck } from "@watch-recommender/shared";

export const deckRouter = Router();

deckRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const profile = await getLatestTagProfile(req.user!.userId, "onboarding");
  if (!profile) {
    return res.status(409).json({ error: "Complete the onboarding quiz first" });
  }

  const excludedIds = await getSwipedTitleIds(req.user!.userId);
  const deck = buildDeck(profile.tagProfile, await getAllTitleSeeds(), {
    excludedIds,
    filters: profile.filters,
  });

  res.json({ deck: deck.map(toApiTitleFromSeed) });
});
