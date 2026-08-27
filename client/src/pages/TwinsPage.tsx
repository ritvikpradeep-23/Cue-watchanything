import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UsernameGate } from "../components/UsernameGate";
import { apiGet } from "../lib/api";

interface TwinUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  similarity: number;
}

function TwinCard({ u }: { u: TwinUser }) {
  return (
    <Link to={`/twins/${u.username}`} className="surface-interactive flex items-center gap-3 bg-[var(--bg-elevated)] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500 text-sm font-normal text-[var(--on-accent)]">
        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" /> : u.username[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{u.username}</p>
        <p className="text-xs font-normal text-[var(--text-muted)]">{Math.round(u.similarity * 100)}% match</p>
      </div>
    </Link>
  );
}

function TwinsPageInner() {
  const [suggested, setSuggested] = useState<TwinUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TwinUser[] | null>(null);

  useEffect(() => {
    apiGet<{ users: TwinUser[] }>("/social/suggested").then((res) => setSuggested(res.users));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      apiGet<{ users: TwinUser[] }>(`/social/search?q=${encodeURIComponent(query.trim())}`).then((res) =>
        setResults(res.users),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Taste twins</h1>
      <p className="mb-6 text-sm font-medium text-[var(--text-muted)]">Find people whose taste overlaps with yours.</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username…"
        className="mb-6 w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
      />

      {results ? (
        <div className="flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-sm font-normal text-[var(--text-muted)]">No users found.</p>
          ) : (
            results.map((u) => <TwinCard key={u.id} u={u} />)
          )}
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold">Suggested matches</h2>
          {!suggested ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          ) : suggested.length === 0 ? (
            <p className="surface p-4 text-sm font-normal text-[var(--text-muted)]">
              No suggestions yet —{" "}
              <Link to="/quiz" className="font-medium text-[var(--text-accent)] hover:underline">
                take the quiz
              </Link>{" "}
              and swipe a bit first.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {suggested.map((u) => (
                <TwinCard key={u.id} u={u} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TwinsPage() {
  return (
    <UsernameGate>
      <TwinsPageInner />
    </UsernameGate>
  );
}
