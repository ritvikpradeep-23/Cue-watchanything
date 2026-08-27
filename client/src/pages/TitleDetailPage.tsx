import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { TagProfile } from "@watch-recommender/shared";
import { PosterImage } from "../components/ui/PosterImage";
import { TasteRadarChart } from "../components/ui/TasteRadarChart";
import { TitleCarousel } from "../components/TitleCarousel";
import { apiGet, apiPost } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { DeckTitle } from "../components/SwipeCard";

interface ApiTitle {
  id: string;
  name: string;
  type: string;
  plotSummary: string;
  cast: string[];
  seasons: number | null;
  episodes: number | null;
  runtimeMinutes: number | null;
  releaseYear: number;
  platforms: string[];
  posterUrl: string;
  tags: Record<string, string[]>;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  displayName: string;
}

export function TitleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState<ApiTitle | null>(null);
  const [ratingSummary, setRatingSummary] = useState<{ average: number | null; count: number } | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [tagProfile, setTagProfile] = useState<TagProfile | null>(null);
  const [similar, setSimilar] = useState<DeckTitle[]>([]);
  const [avoidGenres, setAvoidGenres] = useState<string[]>([]);
  const [confirmingRegret, setConfirmingRegret] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiGet<{ title: ApiTitle; rating: { average: number | null; count: number } }>(`/titles/${id}`).then((res) => {
      setTitle(res.title);
      setRatingSummary(res.rating);
    });
    apiGet<{ ratings: Review[] }>(`/titles/${id}/ratings`).then((res) => setReviews(res.ratings));
    apiGet<{ titles: DeckTitle[] }>(`/titles/${id}/similar`).then((res) => setSimilar(res.titles));
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<{ tagProfile: TagProfile; avoidGenres: string[] }>("/profile").then((res) => {
      setTagProfile(res.tagProfile);
      setAvoidGenres(res.avoidGenres ?? []);
    });
  }, [isAuthenticated]);

  const conflictingGenres = title ? (title.tags.genre ?? []).filter((g) => avoidGenres.includes(g)) : [];

  async function handleAction(action: "like" | "super_like" | "pass") {
    if (!id) return;
    // Regret-proofing: super-like is a strong signal, so double-check before committing if the
    // title conflicts with a genre the user said they'd rather avoid.
    if (action === "super_like" && conflictingGenres.length > 0 && !confirmingRegret) {
      setConfirmingRegret(true);
      return;
    }
    setConfirmingRegret(false);
    await apiPost("/actions", { titleId: id, action });
    setStatus(action === "like" ? "Added to watchlist" : action === "super_like" ? "Super-liked" : "Passed");
  }

  async function handleRate() {
    if (!id || myRating < 1) return;
    await apiPost(`/titles/${id}/ratings`, { rating: myRating, comment: myComment || undefined });
    setStatus("Rating saved");
    const res = await apiGet<{ ratings: Review[] }>(`/titles/${id}/ratings`);
    setReviews(res.ratings);
  }

  if (!title) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-10">
      <div className="mx-auto max-w-4xl">
      <div className="grid gap-8 sm:grid-cols-[280px_1fr]">
        <PosterImage src={title.posterUrl} alt={title.name} active className="surface aspect-[2/3] w-full object-cover" />

        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{title.name}</h1>
          <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
            {title.releaseYear} · {title.type.toUpperCase()}
            {title.seasons ? ` · ${title.seasons} season${title.seasons > 1 ? "s" : ""}` : ""}
            {title.episodes ? ` · ${title.episodes} episodes` : ""}
            {title.runtimeMinutes ? ` · ${title.runtimeMinutes} min` : ""}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {title.tags.genre?.map((g) => (
              <span key={g} className="chip bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">
                {g}
              </span>
            ))}
          </div>

          {tagProfile && Object.keys(tagProfile).length > 0 && (
            <div className="surface mt-4 flex flex-col items-center gap-1 bg-[var(--bg-elevated)] p-4 sm:w-fit">
              <p className="text-xs font-medium tracking-wide text-[var(--text-muted)]">Why this matches you</p>
              <TasteRadarChart userProfile={tagProfile} tags={title.tags as any} size={200} />
            </div>
          )}

          <p className="mt-4 leading-relaxed text-[var(--text)]">{title.plotSummary}</p>

          <p className="mt-4 text-sm">
            <span className="font-semibold">Cast: </span>
            <span className="text-[var(--text-muted)]">{title.cast.join(", ")}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {title.platforms.map((p) => (
              <span
                key={p}
                className="chip bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text)]"
              >
                {p}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="font-semibold">Community rating:</span>
            {ratingSummary?.average ? (
              <span className="font-medium">
                ★ {ratingSummary.average.toFixed(1)} ({ratingSummary.count})
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">No ratings yet</span>
            )}
          </div>

          {isAuthenticated && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => handleAction("like")}
                className="surface-interactive bg-accent-500 px-4 py-2.5 text-sm font-medium text-[var(--on-accent)]"
              >
                Add to watchlist
              </button>
              <button
                onClick={() => handleAction("super_like")}
                className="surface-interactive bg-gold-400 px-4 py-2.5 text-sm font-medium text-[var(--ink)]"
              >
                ★ Super-like
              </button>
              <button
                onClick={() => handleAction("pass")}
                className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-medium"
              >
                Not interested
              </button>
            </div>
          )}
          {confirmingRegret && (
            <div className="surface mt-3 flex flex-wrap items-center gap-3 bg-[var(--bg-elevated)] p-3">
              <p className="text-sm font-normal">
                Heads up — this is tagged {conflictingGenres.join(", ")}, which you said you'd rather
                avoid. Still want to super-like it?
              </p>
              <button
                onClick={() => handleAction("super_like")}
                className="surface-interactive bg-accent-500 px-3 py-1.5 text-xs font-medium text-[var(--on-accent)]"
              >
                Yes, super-like it
              </button>
              <button
                onClick={() => setConfirmingRegret(false)}
                className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          )}
          {status && <p className="mt-2 text-sm font-medium text-[var(--text-accent)]">{status}</p>}
        </div>
      </div>

      {isAuthenticated && (
        <div className="surface mt-10 bg-[var(--bg-elevated)] p-6">
          <h2 className="mb-3 text-xl font-semibold tracking-tight sm:text-2xl">Rate & review</h2>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setMyRating(n)}
                className={`text-2xl ${n <= myRating ? "text-[var(--text-accent)]" : "text-[var(--border)]"}`}
                aria-label={`${n} stars`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            placeholder="Optional comment"
            rows={3}
            className="mt-3 w-full rounded-xl border-2 border-[var(--ink)] bg-transparent p-3 text-sm outline-none"
          />
          <button
            onClick={handleRate}
            disabled={myRating < 1}
            className="surface-interactive mt-3 bg-accent-500 px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] disabled:opacity-40"
          >
            Submit rating
          </button>
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No reviews yet — be the first.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="surface p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.displayName}</span>
                  <span className="text-[var(--text-accent)]">{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-[var(--text-muted)]">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {similar.length > 0 && <TitleCarousel heading="More like this" titles={similar} />}

      <div className="mx-auto max-w-4xl">
      <Link to="/swipe" className="mt-10 inline-block text-sm font-medium text-[var(--text-accent)] hover:underline">
        ← Back to swipe deck
      </Link>
      </div>
    </div>
  );
}
