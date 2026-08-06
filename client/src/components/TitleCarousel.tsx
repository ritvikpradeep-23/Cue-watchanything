import { Link } from "react-router-dom";
import { PosterImage } from "./ui/PosterImage";
import { useDragScroll } from "../lib/useDragScroll";
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
        <h2 className="text-xl font-black uppercase tracking-tight sm:text-2xl">{heading}</h2>
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
  return (
    <Link
      to={`/titles/${title.id}`}
      className="pop-pressable group relative block w-40 shrink-0 overflow-hidden bg-[var(--bg-elevated)] sm:w-48"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <PosterImage src={title.posterUrl} alt={title.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        {title.trending && (
          <span className="pop-badge absolute left-1.5 top-1.5 bg-accent-500 px-1.5 py-0.5 text-[9px] text-[var(--ink)]">
            {Math.round(title.trending.likeRatio * 100)}% liked
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-[var(--ink)] p-2 transition-transform duration-200 group-hover:translate-y-0">
          <p className="line-clamp-2 text-xs font-medium text-[var(--bg-elevated)]">{title.plotSummary}</p>
        </div>
      </div>
      <div className="border-t-[3px] border-[var(--ink)] p-2.5">
        <p className="truncate text-sm font-black uppercase tracking-tight">{title.name}</p>
        <p className="truncate text-xs font-bold text-accent-600">{title.platforms?.[0] ?? title.tags.genre[0]}</p>
      </div>
    </Link>
  );
}
