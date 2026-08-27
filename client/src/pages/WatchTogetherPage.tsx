import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { SwipeCard, type DeckTitle } from "../components/SwipeCard";
import { PosterImage } from "../components/ui/PosterImage";
import { apiGet, apiPost } from "../lib/api";

interface SessionData {
  id: string;
  deck: DeckTitle[];
  watchlist: { id: string; name: string; posterUrl: string }[];
}

export function WatchTogetherPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SessionData | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    apiGet<SessionData>(`/social/watch-together/${sessionId}`).then(setData);
  }, [sessionId]);

  const handleSwipe = useCallback(
    (direction: "pass" | "like" | "super_like") => {
      if (!sessionId) return;
      setData((prev) => {
        if (!prev || prev.deck.length === 0) return prev;
        const [current, ...rest] = prev.deck;
        apiPost(`/social/watch-together/${sessionId}/actions`, { titleId: current.id, action: direction }).catch(() => {});
        return { ...prev, deck: rest };
      });
    },
    [sessionId],
  );

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Watch together</h1>
      <p className="mb-8 text-sm font-medium text-[var(--text-muted)]">
        A shared deck blended from both your taste profiles — swipe to build a joint watchlist.
      </p>

      <div className="relative h-[520px] w-full">
        {data.deck.length === 0 ? (
          <div className="surface flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="font-normal text-[var(--text-muted)]">That's everything in this shared deck.</p>
          </div>
        ) : (
          data.deck
            .slice(0, 3)
            .map((title, i) => (
              <SwipeCard key={title.id} title={title} stackIndex={i} onSwipe={handleSwipe} onOpenDetail={() => {}} />
            ))
            .reverse()
        )}
      </div>

      {data.deck.length > 0 && (
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => handleSwipe("pass")}
            aria-label="Pass"
            className="surface-interactive flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-2xl text-[var(--text-dismiss)]"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe("super_like")}
            aria-label="Super like"
            className="surface-interactive flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xl text-[var(--text-gold)]"
          >
            ★
          </button>
          <button
            onClick={() => handleSwipe("like")}
            aria-label="Like"
            className="surface-interactive flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-2xl text-[var(--on-accent)]"
          >
            ♥
          </button>
        </div>
      )}

      {data.watchlist.length > 0 && (
        <div className="mt-10 w-full">
          <h2 className="mb-3 text-lg font-semibold">Joint watchlist</h2>
          <div className="flex flex-wrap gap-3">
            {data.watchlist.map((t) => (
              <Link key={t.id} to={`/titles/${t.id}`} className="w-20 shrink-0">
                <PosterImage src={t.posterUrl} alt={t.name} className="aspect-[2/3] w-full" />
                <p className="mt-1 truncate text-xs font-normal">{t.name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
