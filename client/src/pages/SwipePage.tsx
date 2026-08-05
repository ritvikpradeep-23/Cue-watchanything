import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SwipeCard, type DeckTitle } from "../components/SwipeCard";
import { apiGet, apiPost, ApiError } from "../lib/api";

export function SwipePage() {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ deck: DeckTitle[] }>("/deck")
      .then((res) => setDeck(res.deck))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) {
          navigate("/quiz");
        } else {
          setError(e.message ?? "Failed to load your deck");
        }
      });
  }, [navigate]);

  async function handleSwipe(direction: "pass" | "like" | "super_like") {
    if (!deck || deck.length === 0) return;
    const [current, ...rest] = deck;
    setDeck(rest);
    try {
      await apiPost("/actions", { titleId: current.id, action: direction });
    } catch {
      // best-effort — the swipe already committed visually; a failed log shouldn't block the session
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Swipe deck</h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        {deck.length > 0 ? `${deck.length} left in this batch` : "You've been through the whole batch"}
      </p>

      <div className="relative h-[520px] w-full">
        {deck.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="mb-4 text-[var(--text-muted)]">
              That's everything scored highly for your taste profile right now.
            </p>
            <button
              onClick={() => navigate("/watchlist")}
              className="rounded-xl bg-accent-500 px-5 py-2.5 font-semibold text-white hover:bg-accent-600"
            >
              View watchlist
            </button>
          </div>
        ) : (
          deck
            .slice(0, 3)
            .map((title, i) => (
              <SwipeCard
                key={title.id}
                title={title}
                stackIndex={i}
                onSwipe={handleSwipe}
                onOpenDetail={() => navigate(`/titles/${title.id}`)}
              />
            ))
            .reverse()
        )}
      </div>

      {deck.length > 0 && (
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => handleSwipe("pass")}
            aria-label="Pass"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-2xl text-rose-500 shadow-md hover:scale-105 transition-transform"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe("super_like")}
            aria-label="Super like"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-xl text-amber-400 shadow-md hover:scale-105 transition-transform"
          >
            ★
          </button>
          <button
            onClick={() => handleSwipe("like")}
            aria-label="Like"
            className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-2xl text-emerald-500 shadow-md hover:scale-105 transition-transform"
          >
            ♥
          </button>
        </div>
      )}
    </div>
  );
}
