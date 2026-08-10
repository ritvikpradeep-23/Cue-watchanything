import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiPost, ApiError } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ message: string }>("/auth/forgot-password", { email });
      // Always the same generic message, regardless of whether the account exists — the
      // server already guarantees this, but the client shouldn't branch on it either.
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Forgot password</h1>
      <p className="mb-6 text-sm font-bold text-[var(--text-muted)]">
        Enter your email and we'll send a reset link if an account exists.
      </p>

      {message ? (
        <div className="surface bg-[var(--bg-elevated)] p-6">
          <p className="text-sm font-semibold">{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="surface flex flex-col gap-4 bg-[var(--bg-elevated)] p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
            />
          </div>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="surface-interactive mt-2 bg-accent-500 px-4 py-3 font-semibold text-[var(--on-accent)] disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-muted)]">
        <Link to="/login" className="font-semibold text-[var(--text-accent)] hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
