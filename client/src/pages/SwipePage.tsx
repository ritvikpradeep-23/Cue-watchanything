import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SwipeCard, type DeckTitle } from "../components/SwipeCard";
import { apiGet, apiPost, ApiError } from "../lib/api";

interface RegretWarning {
  titleId: string;
  titleName: string;
  conflictingGenres: string[];
}

export function SwipePage() {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regretWarning, setRegretWarning] = useState<RegretWarning | null>(null);
  const [comfortZone, setComfortZone] = useState(() => localStorage.getItem("watchrec_comfort_zone") === "true");
  const avoidGenres = useRef<string[]>([]);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem("watchrec_comfort_zone", String(comfortZone));
    setDeck(null);
    apiGet<{ deck: DeckTitle[]; avoidGenres: string[] }>(`/deck${comfortZone ? "?comfortZone=true" : ""}`)
      .then((res) => {
        setDeck(res.deck);
        avoidGenres.current = res.avoidGenres ?? [];
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) {
          navigate("/quiz");
        } else {
          setError(e.message ?? "Failed to load your deck");
        }
      });
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [navigate, comfortZone]);

  function showRegretWarning(title: DeckTitle, conflictingGenres: string[]) {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setRegretWarning({ titleId: title.id, titleName: title.name, conflictingGenres });
    dismissTimer.current = setTimeout(() => setRegretWarning(null), 8000);
  }

  function undoRegretSuperLike() {
    if (!regretWarning) return;
    apiPost("/actions", { titleId: regretWarning.titleId, action: "pass" }).catch(() => {});
    setRegretWarning(null);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }

  const handleSwipe = useCallback((direction: "pass" | "like" | "super_like") => {
    setDeck((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [current, ...rest] = prev;
      apiPost("/actions", { titleId: current.id, action: direction }).catch(() => {
        // best-effort — the swipe already committed visually; a failed log shouldn't block the session
      });

      // Regret-proofing: super-like is a strong signal, so flag it (non-blocking — the like
      // already went through) if it conflicts with a genre the user said they'd rather avoid.
      if (direction === "super_like" && avoidGenres.current.length > 0) {
        const conflicting = current.tags.genre.filter((g) => avoidGenres.current.includes(g));
        if (conflicting.length > 0) showRegretWarning(current, conflicting);
      }

      return rest;
    });
  }, []);

  // Supplementary control for keyboard/desktop users alongside mouse drag (Pointer Events on
  // SwipeCard already handle drag for both mouse and touch) and the on-screen buttons below.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") handleSwipe("pass");
      else if (e.key === "ArrowRight") handleSwipe("like");
      else if (e.key === "ArrowUp") handleSwipe("super_like");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSwipe]);

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
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Swipe deck</h1>
      <p className="mb-1 text-sm font-bold text-[var(--text-muted)]">
        {deck.length > 0 ? `${deck.length} left in this batch` : "You've been through the whole batch"}
      </p>
      <p className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
        Drag the card, use the buttons below, or the arrow keys.
      </p>

      <button
        onClick={() => setComfortZone((c) => !c)}
        className={`chip mb-8 px-3 py-1.5 text-xs ${
          comfortZone ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
        }`}
        title="Try something outside your usual picks"
      >
        {comfortZone ? "✓ " : ""}Try something new
      </button>

      <div className="relative h-[520px] w-full">
        {deck.length === 0 ? (
          <div className="surface flex h-full flex-col items-center justify-center p-8 text-center">
            <p className="mb-4 font-semibold text-[var(--text-muted)]">
              That's everything scored highly for your taste profile right now.
            </p>
            <button
              onClick={() => navigate("/watchlist")}
              className="surface-interactive bg-accent-500 px-5 py-2.5 font-semibold text-[var(--on-accent)]"
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
            className="surface-interactive flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-2xl text-rose-500"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe("super_like")}
            aria-label="Super like"
            className="surface-interactive flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xl text-amber-500"
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

      {regretWarning && (
        <div className="surface fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md flex-col gap-2 bg-[var(--bg-elevated)] p-4 sm:inset-x-auto">
          <p className="text-sm font-semibold">
            Heads up — <span className="font-bold">{regretWarning.titleName}</span> is tagged{" "}
            {regretWarning.conflictingGenres.map((g) => g.replace(/-/g, " ")).join(", ")}, which you
            said you'd rather avoid. Still want to super-like it?
          </p>
          <div className="flex gap-2">
            <button
              onClick={undoRegretSuperLike}
              className="surface-interactive bg-accent-500 px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
            >
              Undo super-like
            </button>
            <button
              onClick={() => setRegretWarning(null)}
              className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
