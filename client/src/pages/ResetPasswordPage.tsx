import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiPost, ApiError } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16 text-center">
        <div className="surface bg-[var(--bg-elevated)] p-6">
          <p className="text-sm font-normal">
            This reset link is missing its token. Request a new one from the{" "}
            <Link to="/forgot-password" className="font-medium text-[var(--text-accent)] hover:underline">
              forgot password
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Set a new password</h1>
      <p className="mb-6 text-sm font-medium text-[var(--text-muted)]">At least 8 characters.</p>

      {done ? (
        <div className="surface bg-[var(--bg-elevated)] p-6">
          <p className="text-sm font-normal">Password updated. Taking you to log in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="surface flex flex-col gap-4 bg-[var(--bg-elevated)] p-6">
          <div>
            <label className="mb-1 block text-xs font-normal">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-normal">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
            />
          </div>

          {error && <p className="text-sm font-medium text-[var(--text-accent)]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="surface-interactive mt-2 bg-accent-500 px-4 py-3 font-semibold text-[var(--on-accent)] disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
