import { useState } from "react";
import { Link } from "react-router-dom";
import { PosterImage } from "./ui/PosterImage";
import { useDragScroll } from "../lib/useDragScroll";
import { apiPost } from "../lib/api";
import type { DeckTitle } from "./SwipeCard";

interface TitleCarouselProps {
  heading: string;
  subheading?: string;
  titles: DeckTitle[];
}

export function TitleCarousel({ heading, subheading, titles }: TitleCarouselProps) {
  const drag = useDragScroll<HTMLDivElement>();
  if (titles.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{heading}</h2>
        {subheading && <p className="text-sm text-[var(--text-muted)]">{subheading}</p>}
      </div>
      <div
        ref={drag.ref}
        className="carousel-row"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerLeave={drag.onPointerLeave}
        onClickCapture={drag.onClickCapture}
      >
        {titles.map((title) => (
          <CarouselCard key={title.id} title={title} />
        ))}
      </div>
    </section>
  );
}

function CarouselCard({ title }: { title: DeckTitle }) {
  const [added, setAdded] = useState(false);

  async function handleAddToWatchlist(e: React.MouseEvent) {
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
    <Link
      to={`/titles/${title.id}`}
      className="surface group relative z-0 block w-40 shrink-0 overflow-hidden transition-transform duration-200 ease-out will-change-transform hover:z-20 hover:scale-105 focus-visible:z-20 focus-visible:scale-105 sm:w-48"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <PosterImage src={title.posterUrl} alt={title.name} className="h-full w-full" />
        {title.trending && (
          <span className="chip absolute left-1.5 top-1.5 bg-accent-500 px-1.5 py-0.5 text-[9px] text-[var(--on-accent)]">
            {Math.round(title.trending.likeRatio * 100)}% liked
          </span>
        )}

        {/* Netflix-style hover reveal — slides up over the bottom of the poster, staying within
         * the card's own footprint so it's never clipped by the row's horizontal-scroll overflow. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/95 via-black/80 to-transparent p-2.5 pt-8 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <p className="truncate text-sm font-medium text-white">{title.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {title.tags.genre.slice(0, 2).map((g) => (
              <span key={g} className="chip bg-white/15 px-1.5 py-0.5 text-[10px] text-white/90">
                {g}
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={handleAddToWatchlist}
              aria-label={added ? "Added to watchlist" : "Add to watchlist"}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors ${
                added ? "bg-accent-500 text-[var(--on-accent)]" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {added ? "✓" : "+"}
            </button>
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[10px] text-white/80"
            >
              i
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
