import { Router } from "express";
import { runWeightTraining } from "../lib/trainWeights";

export const cronRouter = Router();

/** Vercel Cron only issues GET requests and has no user session to attach — authenticated via
 * a shared secret instead of requireAuth/requireAdmin, same pattern Vercel's own docs
 * recommend for cron endpoints. Set CRON_SECRET in the environment and vercel.json's
 * `crons` entry supplies it automatically as the Authorization header. */
cronRouter.get("/train-weights", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization;
  if (!secret || header !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Not authorized" });
  }

  // Real usage hasn't cleared MIN_INTERACTIONS on its own yet (see
  // scripts/seed-synthetic-swipes.ts), so the nightly run is deliberately including synthetic
  // test data for now, at the owner's explicit request, rather than silently skipping every
  // night until real volume catches up. Set TRAIN_INCLUDE_SYNTHETIC=false in the environment
  // (no redeploy needed) once real usage alone is enough — or run
  // `npm run cleanup:synthetic-swipes -- --delete` to remove the synthetic rows outright,
  // which has the same effect without touching this flag.
  const includeSynthetic = process.env.TRAIN_INCLUDE_SYNTHETIC !== "false";
  const result = await runWeightTraining({ includeSynthetic });
  res.json({ ...result, includeSynthetic });
});
