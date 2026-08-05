import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { quizRouter } from "./routes/quiz";
import { deckRouter } from "./routes/deck";
import { actionsRouter } from "./routes/actions";
import { watchlistRouter } from "./routes/watchlist";
import { titlesRouter } from "./routes/titles";
import { historyRouter } from "./routes/history";
import { profileRouter } from "./routes/profile";
import { nextShowRouter } from "./routes/nextShow";
import { adminRouter } from "./routes/admin";

export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/quiz", quizRouter);
app.use("/api/deck", deckRouter);
app.use("/api/actions", actionsRouter);
app.use("/api/watchlist", watchlistRouter);
app.use("/api/titles", titlesRouter);
app.use("/api/history", historyRouter);
app.use("/api/profile", profileRouter);
app.use("/api/next-show", nextShowRouter);
app.use("/api/admin", adminRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
