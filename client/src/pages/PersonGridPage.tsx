import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { INDUSTRIES } from "@watch-recommender/shared";
import { PersonPhoto } from "../components/ui/PersonPhoto";
import { apiGet } from "../lib/api";

interface Person {
  id: string;
  name: string;
  photoUrl: string | null;
  industry: string[];
  knownForStyles?: string[];
}

interface PersonGridPageProps {
  kind: "actor" | "director";
}

/** Actor Finder and Director Finder are structurally identical (spec: "reuse the same
 * components with a data-source swap") — this one component serves both grid pages. */
export function PersonGridPage({ kind }: PersonGridPageProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const label = kind === "actor" ? "Actors" : "Directors";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ cursor: "0" });
    if (industryFilter) params.set("industry", industryFilter);
    if (kind === "director" && styleFilter) params.set("style", styleFilter);
    apiGet<{
      actors?: Person[];
      directors?: Person[];
      total: number;
      nextCursor: number | null;
      availableStyles?: string[];
    }>(`/${kind}s?${params.toString()}`).then((res) => {
      setPeople((res.actors ?? res.directors)!);
      setTotal(res.total);
      setNextCursor(res.nextCursor);
      if (res.availableStyles) setAvailableStyles(res.availableStyles);
      setLoading(false);
    });
  }, [kind, industryFilter, styleFilter]);

  function loadMore() {
    if (nextCursor === null) return;
    const params = new URLSearchParams({ cursor: String(nextCursor) });
    if (industryFilter) params.set("industry", industryFilter);
    if (kind === "director" && styleFilter) params.set("style", styleFilter);
    apiGet<{ actors?: Person[]; directors?: Person[]; nextCursor: number | null }>(
      `/${kind}s?${params.toString()}`,
    ).then((res) => {
      setPeople((prev) => [...prev, ...(res.actors ?? res.directors)!]);
      setNextCursor(res.nextCursor);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">{label}</h1>
      <p className="mb-6 text-sm font-bold text-[var(--text-muted)]">{total} {label.toLowerCase()}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
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

      {kind === "director" && availableStyles.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          <button
            onClick={() => setStyleFilter(null)}
            className={`chip px-3 py-1 text-[11px] ${
              styleFilter === null ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
            }`}
          >
            All styles
          </button>
          {availableStyles.map((s) => (
            <button
              key={s}
              onClick={() => setStyleFilter((prev) => (prev === s ? null : s))}
              className={`chip px-3 py-1 text-[11px] ${
                styleFilter === s ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)] text-[var(--text)]"
              }`}
            >
              Known for: {s.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        </div>
      ) : people.length === 0 ? (
        <p className="surface p-4 text-sm font-semibold text-[var(--text-muted)]">
          No {label.toLowerCase()} match this filter.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {people.map((p) => (
              <Link
                key={p.id}
                to={`/${kind}s/${p.id}`}
                className="surface-interactive block overflow-hidden bg-[var(--bg-elevated)]"
              >
                <div className="aspect-square w-full overflow-hidden">
                  <PersonPhoto src={p.photoUrl} name={p.name} className="h-full w-full" />
                </div>
                <div className="border-t border-[var(--border)]/10 p-2">
                  <p className="truncate text-xs font-semibold">{p.name}</p>
                  {kind === "director" && p.knownForStyles && p.knownForStyles.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] font-bold text-[var(--text-accent)]">
                      {p.knownForStyles.slice(0, 2).map((s) => s.replace(/-/g, " ")).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {nextCursor !== null && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                className="surface-interactive bg-[var(--bg-elevated)] px-5 py-2.5 text-sm font-semibold"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
