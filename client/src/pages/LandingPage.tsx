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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 grid grid-cols-5 gap-1 opacity-30 blur-sm">
          {POSTER_IDS.map((id) => (
            <img key={id} src={`/posters/${id}.svg`} alt="" className="h-full w-full object-cover" />
          ))}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--bg)]/60 via-[var(--bg)]/85 to-[var(--bg)]" />

        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-28 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Stop scrolling.
            <br />
            <span className="bg-gradient-to-r from-accent-400 to-accent-600 bg-clip-text text-transparent">
              Start watching.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--text-muted)]">
            A quick quiz, a swipe deck, and a running list of what you actually want to watch —
            shows, movies, and anime. No AI guessing, just tag-matched picks and legal streaming
            labels.
          </p>
          <div className="mt-8 flex gap-3">
            {isAuthenticated ? (
              <Link
                to="/swipe"
                className="rounded-xl bg-accent-500 px-6 py-3 font-semibold text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600"
              >
                Go to swipe deck
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="rounded-xl bg-accent-500 px-6 py-3 font-semibold text-white shadow-lg shadow-accent-500/20 hover:bg-accent-600"
                >
                  Get started
                </Link>
                <Link
                  to="/login"
                  className="rounded-xl border border-[var(--border)] px-6 py-3 font-semibold hover:bg-[var(--bg-sunken)]"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { title: "Answer a quick quiz", body: "Mood, pace, comfort level — an adaptive quiz that skips what doesn't apply to you." },
            { title: "Swipe through picks", body: "Left to pass, right to like, up to super-like. Every swipe sharpens your taste profile." },
            { title: "Track & rate", body: "Build a watchlist, mark things watched, and rate them for the community." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
