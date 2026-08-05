import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QuizWizard, type QuizQuestion } from "../components/QuizWizard";
import { PosterImage } from "../components/ui/PosterImage";
import { apiGet, apiPost } from "../lib/api";
import type { DeckTitle } from "../components/SwipeCard";

interface SubmitResult {
  picks: string[];
  titles: DeckTitle[];
  swappable: boolean;
}

export function NextShowPage() {
  const { watchedTitleId } = useParams<{ watchedTitleId: string }>();
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [lastAnswers, setLastAnswers] = useState<Record<string, any>>({});

  async function fetchNext(answers: Record<string, any>): Promise<QuizQuestion | null> {
    const res = await apiGet<{ question: QuizQuestion | null }>(
      `/next-show/next?watchedTitleId=${watchedTitleId}&answers=${encodeURIComponent(JSON.stringify(answers))}`,
    );
    return res.question;
  }

  async function handleComplete(answers: Record<string, any>) {
    setLastAnswers(answers);
    const res = await apiPost<SubmitResult>("/next-show/submit", { watchedTitleId, answers });
    setResult(res);
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
    setResult({
      ...result,
      titles: result.titles.map((t) => (t.id === swapOutTitleId ? res.title : t)),
    });
  }

  if (result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-1 text-2xl font-bold">Your next 3</h1>
        <p className="mb-8 text-sm text-[var(--text-muted)]">
          {result.swappable ? "Not feeling one? Swap it out." : "Locked in — no swapping this round."}
        </p>

        <div className="grid gap-6 sm:grid-cols-3">
          {result.titles.map((t) => (
            <div key={t.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              <Link to={`/titles/${t.id}`}>
                <PosterImage src={t.posterUrl} alt={t.name} active className="h-64 w-full" />
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <Link to={`/titles/${t.id}`} className="font-semibold hover:text-accent-500">
                  {t.name}
                </Link>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-[var(--text-muted)]">{t.plotSummary}</p>
                {result.swappable && (
                  <button
                    onClick={() => handleSwap(t.id)}
                    className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-sunken)]"
                  >
                    Swap this one
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <QuizWizard
      title="Pick next show"
      subtitle="A few quick questions about what you just watched."
      fetchNext={fetchNext}
      onComplete={handleComplete}
    />
  );
}
