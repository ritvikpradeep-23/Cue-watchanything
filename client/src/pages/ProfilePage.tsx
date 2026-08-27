import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "../lib/api";

interface ProfileData {
  user: { id: string; email: string; createdAt: string; username: string | null; avatarUrl: string | null; discoverable: boolean };
  topTags: { tag: string; weight: number }[];
  hasCompletedOnboarding: boolean;
  quizHistory: { id: string; kind: string; createdAt: string; watchedTitleId: string | null }[];
}

interface BlockedUser {
  id: string;
  username: string | null;
}

export function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialSaved, setSocialSaved] = useState(false);
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    apiGet<ProfileData>("/profile").then((res) => {
      setData(res);
      setUsernameDraft(res.user.username ?? "");
    });
    apiGet<{ blocked: BlockedUser[] }>("/social/blocked").then((res) => setBlocked(res.blocked));
  }, []);

  async function handleReset() {
    setResetting(true);
    try {
      await apiPost("/profile/reset-history");
      setResetDone(true);
      setConfirmingReset(false);
    } finally {
      setResetting(false);
    }
  }

  async function saveSocialSettings() {
    setSocialError(null);
    setSocialSaved(false);
    try {
      const res = await apiPatch<{ username: string | null }>("/profile", { username: usernameDraft });
      setData((prev) => (prev ? { ...prev, user: { ...prev.user, username: res.username } } : prev));
      setSocialSaved(true);
    } catch (e) {
      setSocialError(e instanceof ApiError ? e.message : "Failed to save");
    }
  }

  async function toggleDiscoverable() {
    if (!data) return;
    const next = !data.user.discoverable;
    await apiPatch("/profile", { discoverable: next });
    setData((prev) => (prev ? { ...prev, user: { ...prev.user, discoverable: next } } : prev));
  }

  async function unblock(id: string) {
    await apiDelete(`/social/block/${id}`);
    setBlocked((prev) => prev?.filter((b) => b.id !== id) ?? null);
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    setChangingPassword(true);
    try {
      await apiPost("/auth/change-password", { currentPassword, newPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e) {
      setPasswordError(e instanceof ApiError ? e.message : "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Profile</h1>
      <p className="mb-8 text-sm font-medium text-[var(--text-muted)]">{data.user.email}</p>

      <div className="surface bg-[var(--bg-elevated)] p-6">
        <h2 className="mb-3 text-xl font-semibold tracking-tight sm:text-2xl">Your taste profile</h2>
        {data.topTags.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Take the quiz to build a taste profile.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.topTags.map((t) => (
              <div key={t.tag} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm font-medium">{t.tag.replace(/-/g, " ")}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[var(--ink)] bg-[var(--bg-sunken)]">
                  <div
                    className="h-full bg-accent-500"
                    style={{ width: `${Math.min(100, Math.max(6, t.weight * 10))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="surface mt-6 bg-[var(--bg-elevated)] p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Quiz history</h2>
          <Link to="/profile/timeline" className="chip bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">
            See your Taste Timeline →
          </Link>
        </div>
        {data.quizHistory.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No quizzes taken yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.quizHistory.map((q) => (
              <li key={q.id} className="flex justify-between font-medium text-[var(--text-muted)]">
                <span>{q.kind === "onboarding" ? "Onboarding quiz" : "Pick next show"}</span>
                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface mt-6 bg-[var(--bg-elevated)] p-6">
        <h2 className="mb-1 text-xl font-semibold tracking-tight sm:text-2xl">Social</h2>
        <p className="mb-4 text-sm font-medium text-[var(--text-muted)]">
          Set a username to unlock taste twins, friends, and chat. Discoverable users can be
          found by search; either way you can still appear in others' suggested matches.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={usernameDraft}
            onChange={(e) => setUsernameDraft(e.target.value)}
            placeholder="username"
            className="w-48 rounded-xl border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={saveSocialSettings}
            className="surface-interactive bg-accent-500 px-4 py-2 text-sm font-medium text-[var(--on-accent)]"
          >
            Save
          </button>
          {data.user.username && (
            <button
              onClick={toggleDiscoverable}
              className={`chip px-3 py-1.5 text-xs ${
                data.user.discoverable ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)]"
              }`}
            >
              {data.user.discoverable ? "Discoverable" : "Hidden from search"}
            </button>
          )}
        </div>
        {socialError && <p className="mt-2 text-sm font-medium text-[var(--text-accent)]">{socialError}</p>}
        {socialSaved && <p className="mt-2 text-sm font-medium text-[var(--text-accent)]">Saved</p>}
      </div>

      <div className="surface mt-6 bg-[var(--bg-elevated)] p-6">
        <h2 className="mb-1 text-xl font-semibold tracking-tight sm:text-2xl">Change password</h2>
        <p className="mb-4 text-sm font-medium text-[var(--text-muted)]">
          Enter your current password and a new one. Locked out instead?{" "}
          <Link to="/forgot-password" className="font-medium text-[var(--text-accent)] hover:underline">
            Use the email reset link
          </Link>{" "}
          from the login page.
        </p>
        <div className="flex max-w-sm flex-col gap-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            minLength={8}
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm new password"
            minLength={8}
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || newPassword.length < 8}
            className="surface-interactive self-start bg-accent-500 px-4 py-2 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
          >
            {changingPassword ? "Updating…" : "Update password"}
          </button>
        </div>
        {passwordError && <p className="mt-2 text-sm font-medium text-[var(--text-accent)]">{passwordError}</p>}
        {passwordSaved && <p className="mt-2 text-sm font-medium text-[var(--text-accent)]">Password updated</p>}
      </div>

      {blocked && blocked.length > 0 && (
        <div className="surface mt-6 bg-[var(--bg-elevated)] p-6">
          <h2 className="mb-3 text-xl font-semibold tracking-tight sm:text-2xl">Blocked users</h2>
          <div className="flex flex-col gap-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.username ?? "(no username)"}</span>
                <button
                  onClick={() => unblock(b.id)}
                  className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1 text-xs font-medium"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="surface mt-6 bg-[var(--bg-elevated)] p-6">
        <h2 className="mb-1 text-xl font-semibold tracking-tight sm:text-2xl">Settings</h2>
        <p className="mb-4 text-sm font-medium text-[var(--text-muted)]">
          Reset watch history — clears your swipes, likes, super-likes, and watched titles.
          Your taste profile and quiz history stay intact, so your next deck won't start from
          scratch.
        </p>
        {resetDone ? (
          <p className="chip inline-flex bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">
            Watch history cleared
          </p>
        ) : confirmingReset ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium">Are you sure? This can't be undone.</p>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="surface-interactive bg-accent-500 px-4 py-2 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Yes, reset it"}
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              disabled={resetting}
              className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingReset(true)}
            className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium"
          >
            Reset watch history
          </button>
        )}
      </div>
    </div>
  );
}
