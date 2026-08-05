import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password);
      navigate("/quiz");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-3xl font-black uppercase">Create your account</h1>
      <p className="mb-6 text-sm font-bold text-[var(--text-muted)]">Takes a minute. No credit card, no third-party login.</p>

      <form onSubmit={handleSubmit} className="pop-panel flex flex-col gap-4 bg-[var(--bg-elevated)] p-6">
        <div>
          <label className="mb-1 block text-xs font-black uppercase">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-black uppercase">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2.5 text-sm outline-none"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">At least 8 characters.</p>
        </div>

        {error && <p className="text-sm font-bold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="pop-pressable mt-2 bg-accent-500 px-4 py-3 font-black uppercase text-[var(--ink)] disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-muted)]">
        Already have an account?{" "}
        <Link to="/login" className="font-black text-accent-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
