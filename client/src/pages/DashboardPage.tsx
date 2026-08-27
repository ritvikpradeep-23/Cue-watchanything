import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GENRES, INDUSTRIES } from "@watch-recommender/shared";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [browseResults, setBrowseResults] = useState<DeckTitle[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [actorMatch, setActorMatch] = useState<{ id: string; name: string } | null>(null);
  const [becauseYouLoved, setBecauseYouLoved] = useState<{ name: string; titles: DeckTitle[] } | null>(null);
  const watchlistDrag = useDragScroll<HTMLDivElement>();

  useEffect(() => {
    apiGet<{ items: DeckTitle[] }>("/watchlist").then((res) => setWatchlist(res.items));
    apiGet<{ titles: DeckTitle[] }>("/titles").then((res) => setCatalog(res.titles));
    apiGet<{ deck: DeckTitle[] }>("/deck")
      .then((res) => setRecommended(res.deck))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) setRecommended([]);
      });
    apiGet<{ topRatedTitleId: string | null }>("/profile").then((res) => {
      if (!res.topRatedTitleId) return;
      apiGet<{ title: DeckTitle }>(`/titles/${res.topRatedTitleId}`).then((titleRes) => {
        apiGet<{ titles: DeckTitle[] }>(`/titles/${res.topRatedTitleId}/similar`).then((similarRes) => {
          if (similarRes.titles.length > 0) {
            setBecauseYouLoved({ name: titleRes.title.name, titles: similarRes.titles });
          }
        });
      });
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

  const activeSearch = searchQuery.trim().length > 0 || industryFilter !== null || genreFilter !== null;

  useEffect(() => {
    if (!activeSearch) {
      setBrowseResults([]);
      return;
    }
    setBrowseLoading(true);
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("query", searchQuery.trim());
      if (industryFilter) params.set("industry", industryFilter);
      if (genreFilter) params.set("genre", genreFilter);
      apiGet<{ titles: DeckTitle[]; actorMatch: { id: string; name: string } | null }>(`/browse?${params.toString()}`)
        .then((res) => {
          setBrowseResults(res.titles);
          setActorMatch(res.actorMatch);
        })
        .finally(() => setBrowseLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery, industryFilter, genreFilter, activeSearch]);

  const heroPosters = (recommended && recommended.length > 0 ? recommended : catalog)?.slice(0, 10) ?? [];

  return (
    <div>
      <section className="hero-backdrop relative -mt-16 h-[70vh] min-h-[420px] overflow-hidden pt-16">
        {heroPosters.length > 0 && (
          <div className="absolute inset-0 -z-10 grid grid-cols-5 gap-1 opacity-70">
            {heroPosters.map((t) => (
              <img key={t.id} src={t.posterUrl} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
        )}
        <div className="relative z-10 mx-auto flex h-full max-w-[1800px] flex-col justify-end px-4 pb-12">
          <h1 className="max-w-lg text-3xl font-semibold sm:text-5xl">Welcome back</h1>
          <p className="mt-3 max-w-md text-sm text-[var(--text-muted)] sm:text-base">
            Pick up where you left off, or let us find something new — your taste profile keeps
            getting sharper with every swipe.
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              to="/swipe"
              className="surface-interactive bg-accent-500 px-5 py-2.5 text-sm font-medium text-[var(--on-accent)]"
            >
              Go to swipe deck
            </Link>
            <Link to="/watchlist" className="surface-interactive bg-[var(--bg-elevated)] px-5 py-2.5 text-sm font-medium">
              My watchlist
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1800px] px-4 pb-8">
      <section className="mb-10 pt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Browse</h2>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles, actors, or tags…"
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2 text-sm outline-none sm:w-72"
          />
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <button
            onClick={() => setIndustryFilter(null)}
            className={`chip px-3 py-1 text-[11px] ${
              industryFilter === null ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
            }`}
          >
            All industries
          </button>
          {INDUSTRIES.map((i) => (
            <button
              key={i}
              onClick={() => setIndustryFilter((prev) => (prev === i ? null : i))}
              className={`chip px-3 py-1 text-[11px] ${
                industryFilter === i ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setGenreFilter(null)}
            className={`chip px-3 py-1 text-[11px] ${
              genreFilter === null ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
            }`}
          >
            All genres
          </button>
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setGenreFilter((prev) => (prev === g ? null : g))}
              className={`chip px-3 py-1 text-[11px] ${
                genreFilter === g ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
              }`}
            >
              {g.replace(/-/g, " ")}
            </button>
          ))}
        </div>

        {activeSearch && (
          <div className="mt-4">
            {actorMatch && (
              <Link
                to={`/actors/${actorMatch.id}`}
                className="surface-interactive mb-3 block bg-accent-500 px-4 py-2.5 text-sm font-medium text-[var(--on-accent)]"
              >
                View {actorMatch.name}'s profile →
              </Link>
            )}
            {browseLoading && browseResults.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-[2/3] w-full" />
                ))}
              </div>
            ) : browseResults.length === 0 ? (
              <p className="surface p-4 text-sm font-normal text-[var(--text-muted)]">No titles match.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {browseResults.map((t) => (
                  <Link
                    key={t.id}
                    to={`/titles/${t.id}`}
                    className="poster-card group relative z-0 block transition-transform duration-200 ease-spring will-change-transform hover:z-20 hover:scale-105 focus-visible:z-20 focus-visible:scale-105"
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden">
                      <PosterImage src={t.posterUrl} alt={t.name} className="h-full w-full" />
                    </div>
                    <div className="border-t border-[var(--border)]/10 bg-[var(--bg-elevated)] p-1.5">
                      <p className="truncate text-xs font-normal">{t.name}</p>
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
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Your watchlist</h2>
            <Link to="/watchlist" className="chip bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">
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
                className="poster-card group relative z-0 block w-28 shrink-0 transition-transform duration-200 ease-spring will-change-transform hover:z-20 hover:scale-105 focus-visible:z-20 focus-visible:scale-105 sm:w-32"
              >
                <div className="aspect-[2/3] w-full overflow-hidden">
                  <PosterImage src={t.posterUrl} alt={t.name} className="h-full w-full" />
                </div>
                <div className="border-t border-[var(--border)]/10 bg-[var(--bg-elevated)] p-1.5">
                  <p className="truncate text-xs font-normal">{t.name}</p>
                  <p className="truncate text-[10px] font-medium text-[var(--text-accent)]">{t.platforms?.[0] ?? "—"}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {watchlist && watchlist.length === 0 && (
        <div className="surface mb-10 p-6 text-center">
          <p className="font-normal text-[var(--text-muted)]">
            Nothing in your watchlist yet.{" "}
            <Link to="/swipe" className="font-medium text-[var(--text-accent)] underline">
              Go swipe
            </Link>{" "}
            to start saving titles.
          </p>
        </div>
      )}

      {recommended && recommended.length > 0 && (
        <TitleCarousel heading="Recommended for you" titles={recommended.slice(0, 14)} />
      )}

      {becauseYouLoved && (
        <TitleCarousel heading={`Because you loved ${becauseYouLoved.name}`} titles={becauseYouLoved.titles} />
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

      {!catalog &&
        Array.from({ length: 2 }).map((_, row) => (
          <div key={row} className="mb-10">
            <div className="skeleton mb-3 h-6 w-40" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[2/3] w-40 shrink-0 sm:w-48" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
