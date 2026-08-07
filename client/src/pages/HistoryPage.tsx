import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PosterImage } from "../components/ui/PosterImage";
import { apiGet, apiPost } from "../lib/api";

interface HistoryItem {
  id: string;
  name: string;
  posterUrl: string;
  plotSummary: string;
  watchedAt: string;
  myRating: number | null;
  myComment: string | null;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { rating: number; comment: string }>>({});

  async function load() {
    const res = await apiGet<{ items: HistoryItem[] }>("/history");
    setItems(res.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRating(titleId: string) {
    const draft = drafts[titleId];
    if (!draft || draft.rating < 1) return;
    await apiPost(`/titles/${titleId}/ratings`, { rating: draft.rating, comment: draft.comment || undefined });
    load();
  }

  if (!items) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Watched history</h1>
          <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">Rate what you've finished, and get 3 picks for what's next.</p>
        </div>
        {items.length > 0 && (
          <Link
            to={`/next-show/${items[0].id}`}
            className="surface-interactive bg-accent-500 px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)]"
          >
            Pick next show
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="surface p-10 text-center font-semibold text-[var(--text-muted)]">
          Nothing marked watched yet. Mark something from your{" "}
          <button onClick={() => navigate("/watchlist")} className="font-semibold text-[var(--text-accent)] hover:underline">
            watchlist
          </button>
          .
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const draft = drafts[item.id] ?? { rating: item.myRating ?? 0, comment: item.myComment ?? "" };
            return (
              <div key={item.id} className="surface flex gap-4 bg-[var(--bg-elevated)] p-4">
                <Link to={`/titles/${item.id}`} className="shrink-0">
                  <PosterImage src={item.posterUrl} alt={item.name} className="aspect-[2/3] w-24 rounded-lg border-2 border-[var(--ink)] object-cover" />
                </Link>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/titles/${item.id}`} className="font-semibold hover:text-[var(--text-accent)]">
                      {item.name}
                    </Link>
                    <Link to={`/next-show/${item.id}`} className="text-xs font-bold text-[var(--text-accent)] hover:underline">
                      Pick next from this →
                    </Link>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{item.plotSummary}</p>

                  <div className="mt-3 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, rating: n } }))
                        }
                        className={`text-xl ${n <= draft.rating ? "text-[var(--text-accent)]" : "text-[var(--border)]"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={draft.comment}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, comment: e.target.value } }))
                    }
                    placeholder="Optional comment"
                    className="mt-2 w-full rounded-lg border-2 border-[var(--ink)] bg-transparent px-3 py-1.5 text-sm outline-none"
                  />
                  <button
                    onClick={() => submitRating(item.id)}
                    disabled={draft.rating < 1}
                    className="surface-interactive mt-2 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-40"
                  >
                    {item.myRating ? "Update rating" : "Save rating"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
