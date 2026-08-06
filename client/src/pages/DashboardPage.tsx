import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { INDUSTRIES } from "@watch-recommender/shared";
import { PosterImage } from "../components/ui/PosterImage";
import { TitleCarousel } from "../components/TitleCarousel";
import { apiGet, ApiError } from "../lib/api";
import { useDragScroll } from "../lib/useDragScroll";
import type { DeckTitle } from "../components/SwipeCard";

const BROWSE_GENRES = ["comedy", "drama", "action", "sci-fi", "horror", "fantasy"];

export function DashboardPage() {
  const [watchlist, setWatchlist] = useState<DeckTitle[] | null>(null);
  const [catalog, setCatalog] = useState<DeckTitle[] | null>(null);
  const [recommended, setRecommended] = useState<DeckTitle[] | null>(null);
  const [actorQuery, setActorQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const watchlistDrag = useDragScroll<HTMLDivElement>();

  useEffect(() => {
    apiGet<{ items: DeckTitle[] }>("/watchlist").then((res) => setWatchlist(res.items));
    apiGet<{ titles: DeckTitle[] }>("/titles").then((res) => setCatalog(res.titles));
    apiGet<{ deck: DeckTitle[] }>("/deck")
      .then((res) => setRecommended(res.deck))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) setRecommended([]);
      });
  }, []);

  const anime = catalog?.filter((t) => t.type === "anime").slice(0, 14) ?? [];
  const newBuzzy = catalog?.filter((t) => t.tags.recency?.includes("new-buzzy")).slice(0, 14) ?? [];
  const hiddenGems = catalog?.filter((t) => t.tags.recency?.includes("hidden-gem")).slice(0, 14) ?? [];
  const newArrivals = useMemo(
    () =>
      catalog
        ? [...catalog]
            .sort((a, b) => new Date(b.dateAdded ?? 0).getTime() - new Date(a.dateAdded ?? 0).getTime())
            .slice(0, 14)
        : [],
    [catalog],
  );

  const activeSearch = actorQuery.trim().length > 0 || industryFilter !== null;
  const searchResults = useMemo(() => {
    if (!catalog || !activeSearch) return [];
    const q = actorQuery.trim().toLowerCase();
    return catalog.filter((t) => {
      const matchesActor = q === "" || (t.cast ?? []).some((c) => c.toLowerCase().includes(q));
      const matchesIndustry = !industryFilter || (t.tags.industry ?? []).includes(industryFilter);
      return matchesActor && matchesIndustry;
    });
  }, [catalog, actorQuery, industryFilter, activeSearch]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="pop-panel stripe-bg relative mb-10 overflow-hidden p-6 sm:p-8">
        <div className="halftone-bg absolute inset-0" />
        <div className="relative">
          <h1 className="text-3xl font-black uppercase text-[var(--on-accent)] sm:text-4xl">Welcome back</h1>
          <p className="mt-1 max-w-lg font-semibold text-[var(--on-accent)]/80">
            Not sure what to watch? Hit the button in the corner, or browse below.
          </p>
        </div>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight sm:text-2xl">Browse</h2>
          <input
            value={actorQuery}
            onChange={(e) => setActorQuery(e.target.value)}
            placeholder="Search by actor…"
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2 text-sm outline-none sm:w-64"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setIndustryFilter(null)}
            className={`pop-badge px-3 py-1 text-[11px] ${
              industryFilter === null ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
            }`}
          >
            All industries
          </button>
          {INDUSTRIES.map((i) => (
            <button
              key={i}
              onClick={() => setIndustryFilter((prev) => (prev === i ? null : i))}
              className={`pop-badge px-3 py-1 text-[11px] ${
                industryFilter === i ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
              }`}
            >
              {i}
            </button>
          ))}
        </div>

        {activeSearch && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="pop-panel p-4 text-sm font-semibold text-[var(--text-muted)]">No titles match.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {searchResults.slice(0, 24).map((t) => (
                  <Link
                    key={t.id}
                    to={`/titles/${t.id}`}
                    className="pop-pressable block overflow-hidden bg-[var(--bg-elevated)]"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden">
                      <PosterImage src={t.posterUrl} alt={t.name} className="h-full w-full" />
                    </div>
                    <div className="border-t-[3px] border-[var(--ink)] p-1.5">
                      <p className="truncate text-xs font-black uppercase">{t.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {watchlist && watchlist.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight sm:text-2xl">Your watchlist</h2>
            <Link to="/watchlist" className="pop-badge bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">
              View all →
            </Link>
          </div>
          <div
            ref={watchlistDrag.ref}
            className="carousel-row"
            onPointerDown={watchlistDrag.onPointerDown}
            onPointerMove={watchlistDrag.onPointerMove}
            onPointerUp={watchlistDrag.onPointerUp}
            onPointerLeave={watchlistDrag.onPointerLeave}
            onClickCapture={watchlistDrag.onClickCapture}
          >
            {watchlist.map((t) => (
              <Link
                key={t.id}
                to={`/titles/${t.id}`}
                className="pop-pressable group block w-28 shrink-0 overflow-hidden bg-[var(--bg-elevated)] sm:w-32"
              >
                <div className="aspect-[2/3] w-full overflow-hidden">
                  <PosterImage src={t.posterUrl} alt={t.name} className="h-full w-full" />
                </div>
                <div className="border-t-[3px] border-[var(--ink)] p-1.5">
                  <p className="truncate text-xs font-black uppercase">{t.name}</p>
                  <p className="truncate text-[10px] font-bold text-accent-600">{t.platforms?.[0] ?? "—"}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {watchlist && watchlist.length === 0 && (
        <div className="pop-panel mb-10 p-6 text-center">
          <p className="font-semibold text-[var(--text-muted)]">
            Nothing in your watchlist yet.{" "}
            <Link to="/swipe" className="font-bold text-accent-600 underline">
              Go swipe
            </Link>{" "}
            to start saving titles.
          </p>
        </div>
      )}

      {recommended && recommended.length > 0 && (
        <TitleCarousel heading="Recommended for you" titles={recommended.slice(0, 14)} />
      )}

      {newArrivals.length > 0 && <TitleCarousel heading="New arrivals" subheading="Most recently added to the catalog" titles={newArrivals} />}
      {newBuzzy.length > 0 && <TitleCarousel heading="New & buzzy" titles={newBuzzy} />}
      {hiddenGems.length > 0 && <TitleCarousel heading="Hidden gems" titles={hiddenGems} />}
      {anime.length > 0 && <TitleCarousel heading="Anime picks" titles={anime} />}

      {catalog &&
        BROWSE_GENRES.map((genre) => {
          const titles = catalog.filter((t) => t.tags.genre?.includes(genre)).slice(0, 14);
          if (titles.length === 0) return null;
          return <TitleCarousel key={genre} heading={genre.replace(/-/g, " ")} titles={titles} />;
        })}

      {!catalog && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
