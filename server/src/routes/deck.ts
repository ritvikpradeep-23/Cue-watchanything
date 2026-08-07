import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { getAllTitleSeeds, toApiTitleFromSeed } from "../lib/titles";
import { getLatestTagProfile, getSwipedTitleIds, computeComfortZoneBoost } from "../lib/userProfile";
import { buildDeck, applyDelta } from "@watch-recommender/shared";

export const deckRouter = Router();

deckRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const profile = await getLatestTagProfile(req.user!.userId, "onboarding");
  if (!profile) {
    return res.status(409).json({ error: "Complete the onboarding quiz first" });
  }

  let tagProfile = profile.tagProfile;
  if (req.query.comfortZone === "true") {
    const boost = await computeComfortZoneBoost(req.user!.userId);
    tagProfile = applyDelta(tagProfile, boost);
  }

  const excludedIds = await getSwipedTitleIds(req.user!.userId);
  const deck = buildDeck(tagProfile, await getAllTitleSeeds(), {
    excludedIds,
    filters: profile.filters,
  });

  res.json({ deck: deck.map(toApiTitleFromSeed), avoidGenres: profile.filters.avoidGenres ?? [] });
});
