import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PosterImage } from "./ui/PosterImage";
import { apiGet } from "../lib/api";

interface ModalTitle {
  id: string;
  name: string;
  type: string;
  plotSummary: string;
  posterUrl: string;
  releaseYear: number;
  seasons: number | null;
  episodes: number | null;
  runtimeMinutes: number | null;
  cast: string[];
  platforms: string[];
  tags: { genre: string[] };
}

interface TitleDetailModalProps {
  /** null closes the modal (and skips fetching) — the same component instance stays mounted
   * across opens so every truncated-summary tap anywhere reuses it instead of each page
   * building its own expand/collapse behavior. */
  titleId: string | null;
  onClose: () => void;
}

function GenreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function CastIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function PlatformIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function InfoSection({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-[var(--text-muted)]">{label}</p>
        <div className="mt-0.5 text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export function TitleDetailModal({ titleId, onClose }: TitleDetailModalProps) {
  const [title, setTitle] = useState<ModalTitle | null>(null);

  useEffect(() => {
    if (!titleId) {
      setTitle(null);
      return;
    }
    apiGet<{ title: ModalTitle }>(`/titles/${titleId}`).then((res) => setTitle(res.title));
  }, [titleId]);

  useEffect(() => {
    if (!titleId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [titleId, onClose]);

  if (!titleId) return null;

  const runtimeLabel = title
    ? title.seasons
      ? `${title.seasons} season${title.seasons > 1 ? "s" : ""}${title.episodes ? ` · ${title.episodes} episodes` : ""}`
      : title.runtimeMinutes
        ? `${title.runtimeMinutes} min`
        : "—"
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="surface relative max-h-[85vh] w-full max-w-2xl overflow-y-auto bg-[var(--bg-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="surface-interactive absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center bg-[var(--bg-elevated)]"
        >
          <CloseIcon />
        </button>

        {!title ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 p-6 sm:grid-cols-[200px_1fr]">
            <PosterImage src={title.posterUrl} alt={title.name} active className="surface aspect-[2/3] w-full object-cover" />

            <div className="min-w-0">
              <Link
                to={`/titles/${title.id}`}
                onClick={onClose}
                className="text-2xl font-semibold tracking-tight hover:text-[var(--text-accent)] sm:text-3xl"
              >
                {title.name}
              </Link>
              <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
                {title.releaseYear} · {title.type.toUpperCase()}
              </p>

              <p className="mt-4 text-sm leading-relaxed text-[var(--text)]">{title.plotSummary}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoSection icon={<GenreIcon />} label="Genre">
                  {title.tags.genre.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {title.tags.genre.map((g) => (
                        <span key={g} className="chip bg-accent-500 px-2 py-0.5 text-[10px] text-[var(--on-accent)]">
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </InfoSection>

                <InfoSection icon={<ClockIcon />} label={title.seasons ? "Seasons" : "Runtime"}>
                  {runtimeLabel}
                </InfoSection>

                <InfoSection icon={<CastIcon />} label="Cast">
                  {title.cast.length > 0 ? title.cast.slice(0, 6).join(", ") : "—"}
                </InfoSection>

                <InfoSection icon={<PlatformIcon />} label="Platforms">
                  {title.platforms.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {title.platforms.map((p) => (
                        <span key={p} className="chip bg-[var(--bg-sunken)] px-2 py-0.5 text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </InfoSection>
              </div>

              <Link
                to={`/titles/${title.id}`}
                onClick={onClose}
                className="surface-interactive mt-5 inline-block bg-accent-500 px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
              >
                Full details, ratings & reviews →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
