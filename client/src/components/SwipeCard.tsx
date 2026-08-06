import { useRef, useState } from "react";
import { PosterImage } from "./ui/PosterImage";

export interface DeckTitle {
  id: string;
  name: string;
  type: string;
  plotSummary: string;
  posterUrl: string;
  tags: { genre: string[]; recency?: string[]; industry?: string[] };
  releaseYear: number;
  platforms?: string[];
  languages?: string[];
  cast?: string[];
  dateAdded?: string;
  trending?: { likeRatio: number; sampleSize: number } | null;
}

type SwipeDirection = "pass" | "like" | "super_like";

interface SwipeCardProps {
  title: DeckTitle;
  stackIndex: number; // 0 = front card
  onSwipe: (direction: SwipeDirection) => void;
  onOpenDetail: () => void;
}

const SWIPE_THRESHOLD = 110;
const SUPER_LIKE_THRESHOLD = -90;

export function SwipeCard({ title, stackIndex, onSwipe, onOpenDetail }: SwipeCardProps) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exiting, setExiting] = useState<SwipeDirection | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const isFront = stackIndex === 0;

  function handlePointerDown(e: React.PointerEvent) {
    if (!isFront) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setDrag({ x: 0, y: 0, active: true });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!start.current || !isFront) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    setDrag({ x: dx, y: dy, active: true });
  }

  function commit(direction: SwipeDirection) {
    setExiting(direction);
    setTimeout(() => onSwipe(direction), 220);
  }

  function handlePointerUp() {
    if (!isFront) return;
    const { x, y } = drag;
    setDrag((d) => ({ ...d, active: false }));
    start.current = null;

    if (y < SUPER_LIKE_THRESHOLD && Math.abs(x) < 80) {
      commit("super_like");
    } else if (x > SWIPE_THRESHOLD) {
      commit("like");
    } else if (x < -SWIPE_THRESHOLD) {
      commit("pass");
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
  }

  function handleClick() {
    if (!moved.current) onOpenDetail();
  }

  const rotation = drag.x / 18;
  const exitTransform =
    exiting === "like"
      ? "translate(140%, -10%) rotate(18deg)"
      : exiting === "pass"
        ? "translate(-140%, -10%) rotate(-18deg)"
        : exiting === "super_like"
          ? "translate(0, -140%) scale(0.9)"
          : undefined;

  const transform = exitTransform ?? `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`;

  const likeOpacity = Math.max(0, Math.min(1, drag.x / SWIPE_THRESHOLD));
  const passOpacity = Math.max(0, Math.min(1, -drag.x / SWIPE_THRESHOLD));
  const superOpacity = Math.max(0, Math.min(1, -drag.y / Math.abs(SUPER_LIKE_THRESHOLD)));

  return (
    <div
      className="absolute inset-0 select-none"
      style={{
        transform: isFront
          ? transform
          : `translateY(${stackIndex * 10}px) scale(${1 - stackIndex * 0.04})`,
        transition: drag.active ? "none" : "transform 0.28s ease, opacity 0.28s ease",
        opacity: exiting ? 0 : 1,
        zIndex: 10 - stackIndex,
        touchAction: "none",
        cursor: isFront ? (drag.active ? "grabbing" : "grab") : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      <div className="pop-panel relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-elevated)]">
        <div className="relative flex-1 overflow-hidden">
          <PosterImage
            src={title.posterUrl}
            alt={title.name}
            active={drag.active || !!exiting}
            className="poster-image--active h-full w-full"
          />

          {isFront && (
            <>
              <div
                className="absolute inset-0 bg-emerald-500/30"
                style={{ opacity: likeOpacity }}
              />
              <div
                className="absolute inset-0 bg-rose-500/30"
                style={{ opacity: passOpacity }}
              />
              <div
                className="absolute inset-0 bg-amber-400/30"
                style={{ opacity: superOpacity }}
              />

              <div
                className="absolute left-6 top-8 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black tracking-widest text-emerald-400"
                style={{ opacity: likeOpacity }}
              >
                LIKED
              </div>
              <div
                className="absolute right-6 top-8 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-black tracking-widest text-rose-400"
                style={{ opacity: passOpacity }}
              >
                PASS
              </div>
              <div
                className="absolute left-1/2 top-8 -translate-x-1/2 rounded-lg border-4 border-amber-300 px-3 py-1 text-2xl font-black tracking-widest text-amber-300"
                style={{ opacity: superOpacity }}
              >
                ★ SUPER
              </div>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 pt-10">
            <h3 className="text-xl font-black uppercase tracking-tight text-white">{title.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-white/85">{title.plotSummary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {title.tags.genre.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="pop-badge border-white/70 bg-accent-500 px-2 py-0.5 text-[10px] text-[var(--on-accent)]"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
