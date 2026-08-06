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
      <section className="relative overflow-hidden border-b-[3px] border-[var(--ink)]">
        <div className="absolute inset-0 -z-10 grid grid-cols-5 gap-1 opacity-60">
          {POSTER_IDS.map((id) => (
            <img key={id} src={`/posters/${id}.svg`} alt="" className="h-full w-full object-cover" />
          ))}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--bg)]/70 via-[var(--bg)]/85 to-[var(--bg)]" />

        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-28 text-center">
          <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Stop scrolling.
            <br />
            <span className="bg-accent-500 px-2 text-[var(--on-accent)]">Start watching.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-semibold text-[var(--text-muted)]">
            A quick quiz, a swipe deck, and a running list of what you actually want to watch —
            shows, movies, and anime. No AI guessing, just tag-matched picks and legal streaming
            labels.
          </p>
          <div className="mt-8 flex gap-3">
            {isAuthenticated ? (
              <Link to="/swipe" className="pop-pressable bg-accent-500 px-6 py-3 font-black uppercase text-[var(--on-accent)]">
                Go to swipe deck
              </Link>
            ) : (
              <>
                <Link to="/signup" className="pop-pressable bg-accent-500 px-6 py-3 font-black uppercase text-[var(--on-accent)]">
                  Get started
                </Link>
                <Link to="/login" className="pop-pressable bg-[var(--bg-elevated)] px-6 py-3 font-black uppercase">
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
            <div key={f.title} className="pop-panel bg-[var(--bg-elevated)] p-6">
              <h3 className="mb-2 text-lg font-black uppercase">{f.title}</h3>
              <p className="text-sm font-medium text-[var(--text-muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
