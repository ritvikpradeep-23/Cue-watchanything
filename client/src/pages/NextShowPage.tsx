import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getNextNextShowQuestion, type NextShowContext, type HardFilters, type TagProfile, type TitleSeed } from "@watch-recommender/shared";
import { QuizWizard } from "../components/QuizWizard";
import { TitleDetailModal } from "../components/TitleDetailModal";
import { PosterImage } from "../components/ui/PosterImage";
import { TasteRadarChart } from "../components/ui/TasteRadarChart";
import { apiGet, apiPost, ApiError } from "../lib/api";
import type { DeckTitle } from "../components/SwipeCard";

interface SubmitResult {
  picks: string[];
  titles: DeckTitle[];
  swappable: boolean;
}

interface ContextResponse {
  baseProfile: TagProfile;
  baseFilters: HardFilters;
  watchedTitle: TitleSeed;
  allTitles: TitleSeed[];
  excludedIds: string[];
}

export function NextShowPage() {
  const { watchedTitleId } = useParams<{ watchedTitleId: string }>();
  const [ctx, setCtx] = useState<NextShowContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [lastAnswers, setLastAnswers] = useState<Record<string, any>>({});
  const [detailTitleId, setDetailTitleId] = useState<string | null>(null);

  useEffect(() => {
    if (!watchedTitleId) return;
    apiGet<ContextResponse>(`/next-show/context/${watchedTitleId}`)
      .then((res) =>
        setCtx({
          baseProfile: res.baseProfile,
          baseFilters: res.baseFilters,
          watchedTitle: res.watchedTitle,
          allTitles: res.allTitles,
          excludedIds: new Set(res.excludedIds),
        }),
      )
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"));
  }, [watchedTitleId]);

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
        <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Your next 3</h1>
        <p className="mb-8 text-sm font-medium text-[var(--text-muted)]">
          {result.swappable ? "Not feeling one? Swap it out." : "Locked in — no swapping this round."}
        </p>

        <div className="grid gap-6 sm:grid-cols-3">
          {result.titles.map((t) => (
            <div key={t.id} className="surface flex flex-col overflow-hidden bg-[var(--bg-elevated)]">
              <Link to={`/titles/${t.id}`}>
                <PosterImage src={t.posterUrl} alt={t.name} active className="aspect-[2/3] w-full" />
              </Link>
              <div className="flex flex-1 flex-col border-t border-[var(--border)]/10 p-4">
                <Link to={`/titles/${t.id}`} className="font-medium hover:text-[var(--text-accent)]">
                  {t.name}
                </Link>
                <p
                  onClick={() => setDetailTitleId(t.id)}
                  className="mt-1 line-clamp-3 cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {t.plotSummary}
                </p>
                {ctx?.baseProfile && (
                  <div className="mt-2 flex justify-center">
                    <TasteRadarChart userProfile={ctx.baseProfile} tags={t.tags as any} size={160} />
                  </div>
                )}
                <div className="flex-1" />
                {result.swappable && (
                  <button
                    onClick={() => handleSwap(t.id)}
                    className="surface-interactive mt-3 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium"
                  >
                    Swap this one
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <TitleDetailModal titleId={detailTitleId} onClose={() => setDetailTitleId(null)} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-[var(--text-accent)]">{error}</p>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <QuizWizard
      title="Pick next show"
      subtitle="A few quick questions about what you just watched."
      getNext={(answers) => getNextNextShowQuestion(answers, ctx)}
      onComplete={handleComplete}
    />
  );
}
