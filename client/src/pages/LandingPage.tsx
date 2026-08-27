import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

const POSTER_IDS = [
  "breaking-bad", "stranger-things", "the-bear", "dune-2021", "parasite",
  "attack-on-titan", "the-last-of-us", "barbie", "your-name", "oppenheimer",
  "money-heist", "arcane", "spiderverse", "demon-slayer", "the-boys",
];

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-[var(--border)]/10">
        {/* aspect-[2/3] per tile — was h-full + object-cover with no aspect constraint, which
         * let the grid's auto row-sizing stretch/crop posters into whatever height the row
         * happened to resolve to rather than their real proportions. */}
        <div className="absolute inset-0 -z-10 grid grid-cols-5 gap-1 opacity-60">
          {POSTER_IDS.map((id) => (
            <img key={id} src={`/posters/${id}.svg`} alt="" className="aspect-[2/3] w-full object-cover" />
          ))}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--bg)]/70 via-[var(--bg)]/85 to-[var(--bg)]" />

        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-28 text-center">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Stop scrolling.
            <br />
            <span className="text-[var(--text-accent)]">Start watching.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-normal leading-relaxed text-[var(--text-muted)]">
            A quick quiz, a swipe deck, and a running list of what you actually want to watch —
            shows, movies, and anime. No AI guessing, just tag-matched picks and legal streaming
            labels.
          </p>
          <div className="mt-8 flex gap-3">
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
      </section>

      {/* Borderless editorial columns, not the generic three-card-grid (no .surface box —
       * hierarchy comes from spacing and a small accent numeral, not a bordered container).
       * Section padding is deliberately generous (py-20/28) — this is the one page in the app
       * that's a marketing surface rather than dense content, so it's the one place real
       * macro-whitespace belongs. */}
      {/* max-w-4xl, matching the hero section above — was max-w-5xl, an off-scale width that
       * made the page's two centered columns not actually line up with each other. */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:py-28">
        <div className="grid gap-12 sm:grid-cols-3">
          {[
            { n: "01", title: "Answer a quick quiz", body: "Mood, pace, comfort level — an adaptive quiz that skips what doesn't apply to you." },
            { n: "02", title: "Swipe through picks", body: "Left to pass, right to like, up to super-like. Every swipe sharpens your taste profile." },
            { n: "03", title: "Track & rate", body: "Build a watchlist, mark things watched, and rate them for the community." },
          ].map((f) => (
            <div key={f.title}>
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
