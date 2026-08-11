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

  const result = await runWeightTraining();
  res.json(result);
});
