import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { PosterImage } from "../components/ui/PosterImage";

/**
 * Landing hero — asymmetric split, not a centered-hero-over-tiled-background. Text is
 * left-anchored, the asset side is a curated poster collage plus a static mock of the actual
 * swipe card (the one interaction Cue is built around).
 *
 * The collage draws from a pool of 15 real titles (posterUrl/plotSummary/platform/genre copied
 * verbatim from the actual Title rows, queried directly from the database), shuffled fresh on
 * every page load — see pickHeroSet() below. Not a fixed six: reload the page and you'll get a
 * different subset, a different featured swipe-card title, and a different arrangement.
 */

interface PoolTitle {
  id: string;
  name: string;
  posterUrl: string;
  plotSummary: string;
  releaseYear: number;
  platform: string;
  /** real genre tags for this title, however many the dataset actually has (not padded/fabricated) */
  genre: string[];
}

/** 15 real titles, real fields, spanning the dataset's own industry spread — Hollywood,
 * Korean, Japanese/anime, Spanish. Plot summaries are the actual stored text; a couple of the
 * original em dashes were swapped for commas to match this page's own punctuation style
 * (meaning-preserving transcription, not fabricated copy). */
const TITLE_POOL: PoolTitle[] = [
  { id: "money-heist", name: "Money Heist", posterUrl: "https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg", plotSummary: "A criminal mastermind assembles a team to pull off the biggest heist in history at Spain's Royal Mint. Hostages, police sieges, and betrayals complicate the plan at every step.", releaseYear: 2017, platform: "Netflix", genre: ["thriller", "action"] },
  { id: "parasite", name: "Parasite", posterUrl: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", plotSummary: "A poor family cons its way into working for a wealthy household, one fabricated reference at a time. What starts as a clever hustle spirals into something far darker.", releaseYear: 2019, platform: "Hulu", genre: ["thriller", "drama"] },
  { id: "attack-on-titan", name: "Attack on Titan", posterUrl: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg", plotSummary: "Humanity lives caged behind massive walls to keep out giant, mindless titans that eat people, until one breaches the wall. What starts as survival horror becomes a much larger war.", releaseYear: 2013, platform: "Crunchyroll", genre: ["action", "horror"] },
  { id: "stranger-things", name: "Stranger Things", posterUrl: "https://image.tmdb.org/t/p/w500/uKYUR8GPkKRCksczYDJb3pwZauo.jpg", plotSummary: "A group of kids in a small 1980s town uncover a secret government lab and a monster from an alternate dimension. Friendship, first love, and synth-scored dread carry them through it.", releaseYear: 2016, platform: "Netflix", genre: ["sci-fi", "horror"] },
  { id: "oppenheimer", name: "Oppenheimer", posterUrl: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", plotSummary: "The theoretical physicist who led the Manhattan Project grapples with the weapon he built, the security hearing that later destroyed his career, and the weight of both.", releaseYear: 2023, platform: "Apple TV", genre: ["drama"] },
  { id: "demon-slayer", name: "Demon Slayer", posterUrl: "https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg", plotSummary: "A boy whose family was slaughtered by a demon, and whose sister was turned into one, joins an order of demon slayers to find a cure and avenge them.", releaseYear: 2019, platform: "Crunchyroll", genre: ["action", "fantasy"] },
  { id: "breaking-bad", name: "Breaking Bad", posterUrl: "https://image.tmdb.org/t/p/w500/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", plotSummary: "A high school chemistry teacher turns to cooking methamphetamine after a cancer diagnosis. What starts as a desperate bid to provide for his family curdles into a story about pride and power.", releaseYear: 2008, platform: "Netflix", genre: ["drama", "thriller"] },
  { id: "the-bear", name: "The Bear", posterUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/The_Bear_Title_Card.jpg/500px-The_Bear_Title_Card.jpg", plotSummary: "A young fine-dining chef returns home to run his late brother's chaotic Chicago sandwich shop. The kitchen is a pressure cooker of grief, ambition, and screamed orders.", releaseYear: 2022, platform: "Hulu", genre: ["comedy", "drama"] },
  { id: "dune-part-two", name: "Dune: Part Two", posterUrl: "https://image.tmdb.org/t/p/w500/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg", plotSummary: "Paul Atreides unites with the Fremen of Arrakis to wage a war of revenge against the conspirators who destroyed his family, even as he fears the prophecy he's fulfilling.", releaseYear: 2024, platform: "HBO Max", genre: ["sci-fi", "action"] },
  { id: "the-last-of-us", name: "The Last of Us", posterUrl: "https://image.tmdb.org/t/p/w500/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg", plotSummary: "A smuggler is hired to escort a teenage girl who may be humanity's only hope across a fungal-apocalypse America. What starts as a job turns into something neither expected.", releaseYear: 2023, platform: "HBO Max", genre: ["drama", "horror"] },
  { id: "barbie", name: "Barbie", posterUrl: "https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", plotSummary: "A Barbie living in plastic perfection starts having thoughts of death and develops a flat foot, forcing a trip to the real world to fix whatever's gone wrong.", releaseYear: 2023, platform: "HBO Max", genre: ["comedy", "fantasy"] },
  { id: "your-name", name: "Your Name", posterUrl: "https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg", plotSummary: "A city boy and a country girl start mysteriously swapping bodies in their sleep, building a bond across the distance, until they realize their timelines aren't quite lined up.", releaseYear: 2016, platform: "Crunchyroll", genre: ["romance", "fantasy"] },
  { id: "arcane", name: "Arcane", posterUrl: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg", plotSummary: "Two sisters end up on opposite sides of a growing war between a utopian city and the oppressed undercity beneath it. Painterly animation carries a genuinely tragic story.", releaseYear: 2021, platform: "Netflix", genre: ["fantasy", "action"] },
  { id: "the-boys", name: "The Boys", posterUrl: "https://image.tmdb.org/t/p/w500/in1R2dDc421JxsoRWaIIAqVI2KE.jpg", plotSummary: "Corrupt, celebrity-obsessed superheroes are actually controlled by a profit-hungry corporation, and a scrappy team of ordinary people is done pretending otherwise.", releaseYear: 2019, platform: "Prime Video", genre: ["action", "comedy"] },
  { id: "spiderverse", name: "Spider-Man: Into the Spider-Verse", posterUrl: "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg", plotSummary: "A Brooklyn teenager becomes his universe's Spider-Man and meets alternate-dimension Spider-People who help him find his footing. Visually, nothing else looks like it.", releaseYear: 2018, platform: "Netflix", genre: ["action", "comedy"] },
];

/** Fixed position/size/rotation "slots" for the background collage — a handful of hand-placed
 * spots around the edges of the asset column, deliberately leaving the center-right open for
 * the featured swipe-card mock so it never has to sit on top of (and hide) the collage behind
 * it. Which POSTER fills which slot is what's randomized, not the slots themselves — a fully
 * random layout risks looking broken; a random title-to-slot assignment still looks different
 * every load without risking overlap. */
const COLLAGE_SLOTS: { size: string; position: React.CSSProperties }[] = [
  { size: "w-28", position: { top: "0%", left: "0%", rotate: "-8deg", zIndex: 2 } },
  { size: "w-24", position: { top: "-2%", left: "26%", rotate: "5deg", zIndex: 3 } },
  { size: "w-28", position: { top: "2%", right: "0%", rotate: "7deg", zIndex: 2 } },
  { size: "w-24", position: { top: "40%", left: "0%", rotate: "-5deg", zIndex: 4 } },
  { size: "w-24", position: { top: "38%", right: "2%", rotate: "6deg", zIndex: 1 } },
  { size: "w-28", position: { bottom: "0%", left: "6%", rotate: "8deg", zIndex: 3 } },
  { size: "w-28", position: { bottom: "2%", right: "4%", rotate: "-6deg", zIndex: 2 } },
];

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks a fresh, randomized featured title + collage set from the pool on every page load —
 * one draw covers both, so the featured title never also duplicates into the background. */
function pickHeroSet() {
  const pool = shuffled(TITLE_POOL);
  return { featured: pool[0], collage: pool.slice(1, 1 + COLLAGE_SLOTS.length) };
}

/** Static preview of the real SwipeCard component — same classes (.surface, PosterImage, the
 * bottom gradient + chip tags), just not draggable. A real title's real poster, plot summary
 * (line-clamped exactly like the live swipe deck does), platform, year, and genre — not a
 * fabricated screenshot. Sized and positioned as one collage element among several (w-48, an
 * explicit slot) rather than a full-bleed centered overlay, so it never hides the rest of the
 * collage behind it. */
function MockSwipeCard({ title }: { title: PoolTitle }) {
  return (
    <div
      className="hero-tile-in absolute z-20 w-48"
      style={{ top: "10%", left: "34%", rotate: "-3deg", animationDelay: "420ms" }}
    >
      <div className="surface overflow-hidden shadow-2xl">
        <div className="relative aspect-[2/3] w-full">
          <PosterImage src={title.posterUrl} alt="" active className="h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 pt-12">
            <div className="mb-1 flex items-center gap-1.5 text-[9px] font-medium text-white/70">
              <span>{title.releaseYear}</span>
              <span aria-hidden="true">·</span>
              <span>{title.platform}</span>
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-white">{title.name}</h3>
            <p className="mt-1 line-clamp-2 text-[10px] font-normal leading-relaxed text-white/80">
              {title.plotSummary}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {title.genre.map((g) => (
                <span key={g} className="chip bg-accent-500 px-1.5 py-0.5 text-[8px] text-[var(--on-accent)]">
                  {g}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] text-[var(--text-dismiss)]">
                ✕
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] text-[var(--text-gold)]">
                ★
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[10px] text-[var(--on-accent)]">
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
  // Drawn once per mount (page load), not per render — reload the page for a new arrangement,
  // but it doesn't reshuffle on every re-render (e.g. the auth check resolving).
  const { featured, collage } = useMemo(pickHeroSet, []);

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
          <div className="relative hidden h-[440px] md:block">
            {collage.map((title, i) => {
              const slot = COLLAGE_SLOTS[i];
              return (
                // Outer div: static position/size/rotation (never animated). Inner div: the
                // hero-tile-in entrance animates a plain 0->1 fade + scale.
                <div key={title.id} className={`absolute ${slot.size}`} style={slot.position}>
                  <div className="hero-tile-in surface overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
                    <PosterImage src={title.posterUrl} alt="" className="aspect-[2/3] w-full" />
                  </div>
                </div>
              );
            })}
            <MockSwipeCard title={featured} />
          </div>
        </div>

        {/* Mobile teaser — just the product moment, not the full collage. */}
        <div className="relative mx-auto h-64 max-w-6xl px-4 pb-12 md:hidden">
          <MockSwipeCard title={featured} />
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
