import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PosterImage } from "../components/ui/PosterImage";
import { apiGet, apiPost } from "../lib/api";

interface WatchlistItem {
  id: string;
  name: string;
  type: string;
  plotSummary: string;
  cast: string[];
  seasons: number | null;
  episodes: number | null;
  runtimeMinutes: number | null;
  platforms: string[];
  posterUrl: string;
  superLiked: boolean;
}

export function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[] | null>(null);

  async function load() {
    const res = await apiGet<{ items: WatchlistItem[] }>("/watchlist");
    setItems(res.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function markWatched(titleId: string) {
    await apiPost(`/watchlist/${titleId}/watched`);
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
      <h1 className="mb-1 text-2xl font-bold">Watchlist</h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">Everything you've liked or super-liked, super-likes first.</p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--text-muted)]">
          Nothing here yet.{" "}
          <Link to="/swipe" className="text-accent-500 hover:underline">
            Go swipe
          </Link>{" "}
          to add some.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
            >
              <Link to={`/titles/${item.id}`} className="shrink-0">
                <PosterImage src={item.posterUrl} alt={item.name} className="h-32 w-24 rounded-lg" />
              </Link>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/titles/${item.id}`} className="font-semibold hover:text-accent-500">
                    {item.name}
                  </Link>
                  {item.superLiked && <span className="text-amber-400">★ Super-liked</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{item.plotSummary}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {item.seasons ? `${item.seasons} seasons` : item.runtimeMinutes ? `${item.runtimeMinutes} min` : ""}
                  {" · "}
                  {item.platforms.join(", ")}
                </p>
                <button
                  onClick={() => markWatched(item.id)}
                  className="mt-3 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600"
                >
                  Mark as watched
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
