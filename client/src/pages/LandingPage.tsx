import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { PosterImage } from "../components/ui/PosterImage";

/**
 * Landing hero redesign — asymmetric split, not a centered-hero-over-tiled-background.
 * Text is left-anchored (right-anchored on the asset side gets real compositional weight
 * instead of a repeating grid), and the asset side is a curated, overlapping poster collage
 * plus a static mock of the actual swipe card — the one interaction Cue is built around,
 * which the previous hero never showed at all.
 *
 * Poster URLs, plot summaries, platforms, and genres below are copied verbatim from the real
 * Title rows for these titles (queried directly from the database) — NOT the /posters/*.svg
 * folder used elsewhere in this file's first draft, which turned out to be generated
 * placeholder graphics (a flat color + a single initial), not real poster art. That first
 * draft technically satisfied "use real dataset posters" by filename, but not by what actually
 * rendered — this is the actual fix.
 */

/** A handful of real, recognizable titles spanning the dataset's own industry spread — not a
 * dense uniform grid, a loose curated cluster. Position/rotation/z chosen by hand for a
 * collaged, non-grid feel (VARIANCE 7 — offset, overlapping, not symmetric). `tileOpacity` is
 * applied on a separate outer wrapper from the entrance animation (see the render loop below
 * and the index.css comment on .hero-tile-in) rather than as a CSS custom property read inside
 * @keyframes, which didn't reliably resolve in testing. */
const COLLAGE_TILES: { id: string; name: string; posterUrl: string; position: React.CSSProperties; size: string; tileOpacity: number }[] = [
  { id: "parasite", name: "Parasite", posterUrl: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", size: "w-28", tileOpacity: 0.85, position: { top: "2%", left: "4%", rotate: "-7deg", zIndex: 1 } },
  { id: "attack-on-titan", name: "Attack on Titan", posterUrl: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg", size: "w-32", tileOpacity: 0.9, position: { top: "0%", left: "34%", rotate: "4deg", zIndex: 1 } },
  { id: "stranger-things", name: "Stranger Things", posterUrl: "https://image.tmdb.org/t/p/w500/uKYUR8GPkKRCksczYDJb3pwZauo.jpg", size: "w-32", tileOpacity: 0.85, position: { top: "4%", right: "2%", rotate: "6deg", zIndex: 1 } },
  { id: "oppenheimer", name: "Oppenheimer", posterUrl: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", size: "w-28", tileOpacity: 0.75, position: { bottom: "6%", left: "12%", rotate: "9deg", zIndex: 1 } },
  { id: "demon-slayer", name: "Demon Slayer", posterUrl: "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg", size: "w-28", tileOpacity: 0.8, position: { bottom: "2%", right: "10%", rotate: "-5deg", zIndex: 1 } },
];

/** Static preview of the real SwipeCard component — same classes (.surface, PosterImage, the
 * bottom gradient + chip tags), just not draggable. This is what "show the actual product"
 * means: a real miniature of the real UI, not a div-built fake screenshot. Money Heist, real
 * poster art, real plot summary (line-clamped exactly like the live swipe deck does), real
 * platform + year + genre tags — everything here is a Title row's actual field values. */
function MockSwipeCard() {
  return (
    <div
      className="hero-tile-in absolute left-1/2 top-1/2 z-10 w-72 -translate-x-1/2 -translate-y-1/2"
      style={{ animationDelay: "420ms" }}
    >
      <div className="surface rotate-[-3deg] overflow-hidden shadow-2xl">
        <div className="relative aspect-[2/3] w-full">
          <PosterImage
            src="https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg"
            alt=""
            active
            className="h-full w-full"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 pt-14">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-white/70">
              <span>2017</span>
              <span aria-hidden="true">·</span>
              <span>Netflix</span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-white">Money Heist</h3>
            <p className="mt-1.5 line-clamp-2 text-xs font-normal leading-relaxed text-white/80">
              A criminal mastermind assembles a team to pull off the biggest heist in history at
              Spain's Royal Mint. Hostages, police sieges, and betrayals complicate the plan at
              every step.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {["thriller", "action"].map((g) => (
                <span key={g} className="chip bg-accent-500 px-1.5 py-0.5 text-[9px] text-[var(--on-accent)]">
                  {g}
                </span>
              ))}
            </div>
            <div className="mt-2.5 flex gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs text-[var(--text-dismiss)]">
                ✕
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs text-[var(--text-gold)]">
                ★
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-xs text-[var(--on-accent)]">
                ♥
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-[var(--border)]/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:min-h-[560px] md:grid-cols-[3fr_2fr] md:items-center md:gap-6 md:py-20">
          {/* Text column — left-anchored on desktop, not centered. Hero stack is exactly three
           * elements (headline, subtext, CTAs) — no eyebrow, no trust strip, nothing extra. */}
          <div className="hero-in relative z-10 text-center md:text-left">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Stop scrolling.
              <br />
              <span className="text-[var(--text-accent)]">Start watching.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg font-normal leading-relaxed text-[var(--text-muted)] md:mx-0">
              A quick quiz, a swipe deck, and a watchlist that's actually yours. Real streaming
              data, no AI guessing.
            </p>
            <div className="mt-8 flex justify-center gap-3 md:justify-start">
              {isAuthenticated ? (
                <Link to="/swipe" className="surface-interactive bg-accent-500 px-6 py-3 font-semibold text-[var(--on-accent)]">
                  Go to swipe deck
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="surface-interactive bg-accent-500 px-6 py-3 font-semibold text-[var(--on-accent)]">
                    Get started
                  </Link>
                  <Link to="/login" className="surface-interactive bg-[var(--bg-elevated)] px-6 py-3 font-semibold">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Asset column — the real visual weight the composition needs on this side, instead
           * of empty space or a repeating tile pattern. Desktop only; mobile gets a simpler
           * single-card teaser below (a scattered collage has no room to breathe under 768px). */}
          <div className="relative hidden h-[420px] md:block">
            {COLLAGE_TILES.map((t, i) => (
              // Outer div: static resting opacity (never animated) + position/rotation. Inner
              // div: the hero-tile-in entrance animates a plain 0->1 fade. CSS opacity
              // multiplies across nested elements, so the visible result during the animation
              // is exactly tileOpacity * animatedOpacity — same visual target as animating
              // straight to tileOpacity, without needing a custom property read inside
              // @keyframes (see index.css comment — that path didn't reliably resolve when the
              // property was set via inline style the same tick the animation starts).
              <div key={t.id} className={`absolute ${t.size}`} style={{ ...t.position, opacity: t.tileOpacity }}>
                <div
                  className="hero-tile-in surface overflow-hidden"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <PosterImage src={t.posterUrl} alt="" className="aspect-[2/3] w-full" />
                </div>
              </div>
            ))}
            <MockSwipeCard />
          </div>
        </div>

        {/* Mobile teaser — just the product moment, not the full collage. */}
        <div className="relative mx-auto h-64 max-w-6xl px-4 pb-12 md:hidden">
          <MockSwipeCard />
        </div>
      </section>

      {/* Borderless editorial columns, staggered vertically instead of three identical
       * same-height columns — breaks the repeating parallel rhythm the flat 3-equal-column
       * layout had even after the earlier pass removed its card chrome. */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:py-28">
        <div className="grid gap-12 sm:grid-cols-3">
          {[
            { n: "01", title: "Answer a quick quiz", body: "Mood, pace, and comfort level feed an adaptive quiz that skips what doesn't apply to you.", offset: "" },
            { n: "02", title: "Swipe through picks", body: "Left to pass, right to like, up to super-like. Every swipe sharpens your taste profile.", offset: "sm:mt-10" },
            { n: "03", title: "Track & rate", body: "Build a watchlist, mark things watched, and rate them for the community.", offset: "sm:mt-20" },
          ].map((f) => (
            <div key={f.title} className={f.offset}>
              <p className="mb-3 text-xs font-medium tracking-wide text-[var(--text-accent)]">{f.n}</p>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm font-normal text-[var(--text-muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
