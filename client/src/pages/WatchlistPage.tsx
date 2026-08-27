import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PosterImage } from "../components/ui/PosterImage";
import { TitleDetailModal } from "../components/TitleDetailModal";
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
  const [detailTitleId, setDetailTitleId] = useState<string | null>(null);

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
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Watchlist</h1>
      <p className="mb-8 text-sm font-medium text-[var(--text-muted)]">Everything you've liked or super-liked, super-likes first.</p>

      {items.length === 0 ? (
        <div className="surface p-10 text-center font-normal text-[var(--text-muted)]">
          Nothing here yet.{" "}
          <Link to="/swipe" className="font-medium text-[var(--text-accent)] hover:underline">
            Go swipe
          </Link>{" "}
          to add some.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.id} className="surface flex gap-4 bg-[var(--bg-elevated)] p-4">
              <Link to={`/titles/${item.id}`} className="shrink-0">
                <PosterImage src={item.posterUrl} alt={item.name} className="aspect-[2/3] w-24 rounded-lg border-2 border-[var(--ink)] object-cover" />
              </Link>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/titles/${item.id}`} className="font-medium hover:text-[var(--text-accent)]">
                    {item.name}
                  </Link>
                  {item.superLiked && <span className="chip bg-gold-400 px-2 py-0.5 text-[10px] text-[var(--ink)]">★ Super</span>}
                </div>
                <p
                  onClick={() => setDetailTitleId(item.id)}
                  className="mt-1 line-clamp-2 cursor-pointer text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {item.plotSummary}
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--text-accent)]">
                  {item.seasons ? `${item.seasons} seasons` : item.runtimeMinutes ? `${item.runtimeMinutes} min` : ""}
                  {" · "}
                  {item.platforms.join(", ")}
                </p>
                <button
                  onClick={() => markWatched(item.id)}
                  className="surface-interactive mt-3 bg-accent-500 px-3 py-1.5 text-xs font-medium text-[var(--on-accent)]"
                >
                  Mark as watched
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TitleDetailModal titleId={detailTitleId} onClose={() => setDetailTitleId(null)} />
    </div>
  );
}
