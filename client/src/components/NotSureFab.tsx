import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getNextOnboardingQuestion,
  getNextNextShowQuestion,
  type NextShowContext,
  type HardFilters,
  type TagProfile,
  type TitleSeed,
} from "@watch-recommender/shared";
import { QuizWizard } from "./QuizWizard";
import { PosterImage } from "./ui/PosterImage";
import { useAuth } from "../lib/auth-context";
import { apiGet, apiPost } from "../lib/api";
import type { DeckTitle } from "./SwipeCard";

interface ContextResponse {
  baseProfile: TagProfile;
  baseFilters: HardFilters;
  watchedTitle: TitleSeed;
  allTitles: TitleSeed[];
  excludedIds: string[];
}

interface SubmitResult {
  titles: DeckTitle[];
  swappable: boolean;
}

type Mode = "loading" | "onboarding" | "next-show" | "results" | "onboarding-done" | "error";

export function NotSureFab() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nextShowCtx, setNextShowCtx] = useState<NextShowContext | null>(null);
  const [watchedTitleId, setWatchedTitleId] = useState<string | null>(null);
  const [lastAnswers, setLastAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("loading");
    setError(null);
    setResult(null);

    (async () => {
      try {
        const history = await apiGet<{ items: { id: string }[] }>("/history");
        if (history.items.length === 0) {
          setMode("onboarding");
          return;
        }
        const titleId = history.items[0].id;
        const ctxRes = await apiGet<ContextResponse>(`/next-show/context/${titleId}`);
        setNextShowCtx({
          baseProfile: ctxRes.baseProfile,
          baseFilters: ctxRes.baseFilters,
          watchedTitle: ctxRes.watchedTitle,
          allTitles: ctxRes.allTitles,
          excludedIds: new Set(ctxRes.excludedIds),
        });
        setWatchedTitleId(titleId);
        setMode("next-show");
      } catch (e: any) {
        setError(e.message ?? "Something went wrong");
        setMode("error");
      }
    })();
  }, [open]);

  async function handleOnboardingComplete(answers: Record<string, any>) {
    await apiPost("/quiz/submit", { answers });
    setMode("onboarding-done");
  }

  async function handleNextShowComplete(answers: Record<string, any>) {
    setLastAnswers(answers);
    const res = await apiPost<SubmitResult>("/next-show/submit", { watchedTitleId, answers });
    setResult(res);
    setMode("results");
  }

  async function handleSwap(swapOutTitleId: string) {
    if (!result) return;
    const keptTitleIds = result.titles.filter((t) => t.id !== swapOutTitleId).map((t) => t.id);
    const res = await apiPost<{ title: DeckTitle }>("/next-show/swap", {
      watchedTitleId,
      answers: lastAnswers,
      keptTitleIds,
      swapOutTitleId,
    });
    setResult({ ...result, titles: result.titles.map((t) => (t.id === swapOutTitleId ? res.title : t)) });
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fab pop-pressable flex items-center gap-2 bg-accent-500 px-5 py-3 font-black uppercase text-[var(--ink)]"
      >
        <span className="text-xl">🤔</span>
        <span className="hidden sm:inline">Not sure what to watch?</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ink)]/60 p-0 sm:items-center sm:p-4">
          <div className="pop-panel relative max-h-[90vh] w-full max-w-xl overflow-y-auto bg-[var(--bg-elevated)] sm:max-h-[85vh]">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="pop-pressable absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center bg-[var(--bg-elevated)] font-black"
            >
              ✕
            </button>

            {mode === "loading" && (
              <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-t-transparent" />
              </div>
            )}

            {mode === "error" && (
              <div className="p-10 text-center">
                <p className="font-bold text-red-600">{error}</p>
              </div>
            )}

            {mode === "onboarding" && (
              <QuizWizard
                title="Taste quiz"
                subtitle="No watch history yet — let's build your taste profile."
                getNext={getNextOnboardingQuestion}
                onComplete={handleOnboardingComplete}
              />
            )}

            {mode === "onboarding-done" && (
              <div className="flex flex-col items-center gap-4 p-10 text-center">
                <p className="text-2xl font-black uppercase">Profile built!</p>
                <Link
                  to="/swipe"
                  onClick={() => setOpen(false)}
                  className="pop-pressable bg-accent-500 px-5 py-2.5 font-black uppercase text-[var(--ink)]"
                >
                  Go swipe
                </Link>
              </div>
            )}

            {mode === "next-show" && nextShowCtx && (
              <QuizWizard
                title="Pick next show"
                subtitle={`A few questions about ${nextShowCtx.watchedTitle.name}.`}
                getNext={(answers) => getNextNextShowQuestion(answers, nextShowCtx)}
                onComplete={handleNextShowComplete}
              />
            )}

            {mode === "results" && result && (
              <div className="p-6">
                <h2 className="mb-1 text-2xl font-black uppercase">Your next 3</h2>
                <p className="mb-6 text-sm text-[var(--text-muted)]">
                  {result.swappable ? "Not feeling one? Swap it out." : "Locked in — no swapping this round."}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {result.titles.map((t) => (
                    <div key={t.id} className="pop-panel overflow-hidden">
                      <Link to={`/titles/${t.id}`} onClick={() => setOpen(false)}>
                        <PosterImage src={t.posterUrl} alt={t.name} active className="aspect-[2/3] w-full" />
                      </Link>
                      <div className="p-2">
                        <Link
                          to={`/titles/${t.id}`}
                          onClick={() => setOpen(false)}
                          className="line-clamp-2 text-xs font-black uppercase hover:text-accent-600"
                        >
                          {t.name}
                        </Link>
                        {result.swappable && (
                          <button
                            onClick={() => handleSwap(t.id)}
                            className="pop-pressable mt-2 w-full bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-bold uppercase"
                          >
                            Swap
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
