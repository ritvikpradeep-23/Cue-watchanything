import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PersonPhoto } from "../components/ui/PersonPhoto";
import { PosterImage } from "../components/ui/PosterImage";
import { TitleDetailModal } from "../components/TitleDetailModal";
import { apiGet, apiPost } from "../lib/api";
import type { DeckTitle } from "../components/SwipeCard";

interface Person {
  id: string;
  name: string;
  photoUrl: string | null;
  industry: string[];
  knownForStyles?: string[];
  bio: string | null;
}

interface DetailResponse {
  actor?: Person;
  director?: Person;
  availableGenres: string[];
  activeGenre: string | null;
  topHits: DeckTitle[];
  filmography: DeckTitle[];
}

interface PersonDetailPageProps {
  kind: "actor" | "director";
}

function TitleCard({ title, onOpenDetail }: { title: DeckTitle; onOpenDetail: (id: string) => void }) {
  const [added, setAdded] = useState(false);

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiPost("/actions", { titleId: title.id, action: "like" });
      setAdded(true);
    } catch {
      // best-effort — a failed quick-add shouldn't block browsing
    }
  }

  return (
    <button
      onClick={() => onOpenDetail(title.id)}
      className="surface-interactive group relative block w-full overflow-hidden bg-[var(--bg-elevated)] text-left"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <PosterImage src={title.posterUrl} alt={title.name} className="h-full w-full" />
        <button
          onClick={handleAdd}
          aria-label={added ? "Added to watchlist" : "Add to watchlist"}
          className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors ${
            added ? "bg-accent-500 text-[var(--on-accent)]" : "bg-black/50 text-white hover:bg-black/70"
          }`}
        >
          {added ? "✓" : "+"}
        </button>
      </div>
      <div className="border-t border-[var(--border)]/10 p-1.5">
        <p className="truncate text-xs font-semibold">{title.name}</p>
      </div>
    </button>
  );
}

export function PersonDetailPage({ kind }: PersonDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [detailTitleId, setDetailTitleId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setData(null);
    setNotFound(false);
    const params = new URLSearchParams();
    if (genreFilter) params.set("genre", genreFilter);
    apiGet<DetailResponse>(`/${kind}s/${id}?${params.toString()}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [kind, id, genreFilter]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="surface p-6 font-bold text-[var(--text-muted)]">
          {kind === "actor" ? "Actor" : "Director"} not found.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  const person = (data.actor ?? data.director)!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start">
        <PersonPhoto src={person.photoUrl} name={person.name} className="h-32 w-32 shrink-0 rounded-xl" />
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{person.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {person.industry.map((i) => (
              <span key={i} className="chip bg-accent-500 px-2 py-0.5 text-[10px] text-[var(--on-accent)]">
                {i}
              </span>
            ))}
          </div>
          {person.knownForStyles && person.knownForStyles.length > 0 && (
            <p className="mt-2 text-sm font-bold text-[var(--text-accent)]">
              Known for: {person.knownForStyles.map((s) => s.replace(/-/g, " ")).join(", ")}
            </p>
          )}
          {person.bio && <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)]">{person.bio}</p>}
        </div>
      </div>

      {data.availableGenres.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-1.5">
          <button
            onClick={() => setGenreFilter(null)}
            className={`chip px-3 py-1 text-[11px] ${
              genreFilter === null ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
            }`}
          >
            All genres
          </button>
          {data.availableGenres.map((g) => (
            <button
              key={g}
              onClick={() => setGenreFilter((prev) => (prev === g ? null : g))}
              className={`chip px-3 py-1 text-[11px] ${
                genreFilter === g ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {data.topHits.length === 0 && data.filmography.length === 0 ? (
        <p className="surface p-4 text-sm font-semibold text-[var(--text-muted)]">
          No titles in this genre.
        </p>
      ) : (
        <>
          {data.topHits.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 text-xl font-semibold tracking-tight sm:text-2xl">Top hits</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {data.topHits.map((t) => (
                  <TitleCard key={t.id} title={t} onOpenDetail={setDetailTitleId} />
                ))}
              </div>
            </section>
          )}

          {data.filmography.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold tracking-tight sm:text-2xl">Full filmography</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {data.filmography.map((t) => (
                  <TitleCard key={t.id} title={t} onOpenDetail={setDetailTitleId} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <TitleDetailModal titleId={detailTitleId} onClose={() => setDetailTitleId(null)} />

      <Link to={`/${kind}s`} className="mt-10 inline-block text-sm font-bold text-[var(--text-accent)] hover:underline">
        ← Back to {kind === "actor" ? "Actors" : "Directors"}
      </Link>
    </div>
  );
}
