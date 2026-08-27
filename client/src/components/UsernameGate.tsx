import { useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPatch, ApiError } from "../lib/api";

/** Social features (search, twins, chat, friends) need a public username. Existing accounts
 * don't have one yet, so this gates access with a lightweight one-time prompt instead of a
 * fabricated default — same pattern used for setting it up front. */
export function UsernameGate({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<{ user: { username: string | null } }>("/profile").then((res) => setUsername(res.user.username));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiPatch("/profile", { username: draft });
      setUsername(draft);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (username === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  if (username === null) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-1 text-2xl font-semibold">Pick a username</h1>
        <p className="mb-6 text-sm font-medium text-[var(--text-muted)]">
          Taste twins, friends, and chat need a public username first.
        </p>
        <form onSubmit={handleSubmit} className="surface flex flex-col gap-3 bg-[var(--bg-elevated)] p-6">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. film_buff_92"
            required
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
          />
          <p className="text-xs text-[var(--text-muted)]">3-20 characters: letters, numbers, underscores.</p>
          {error && <p className="text-sm font-medium text-[var(--text-accent)]">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="surface-interactive bg-accent-500 px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
