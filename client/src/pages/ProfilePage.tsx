import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

interface ProfileData {
  user: { id: string; email: string; createdAt: string };
  topTags: { tag: string; weight: number }[];
  hasCompletedOnboarding: boolean;
  quizHistory: { id: string; kind: string; createdAt: string; watchedTitleId: string | null }[];
}

export function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    apiGet<ProfileData>("/profile").then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Profile</h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">{data.user.email}</p>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <h2 className="mb-3 text-lg font-semibold">Your taste profile</h2>
        {data.topTags.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Take the quiz to build a taste profile.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.topTags.map((t) => (
              <div key={t.tag} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm font-medium capitalize">{t.tag.replace(/-/g, " ")}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                  <div
                    className="h-full rounded-full bg-accent-500"
                    style={{ width: `${Math.min(100, Math.max(6, t.weight * 10))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <h2 className="mb-3 text-lg font-semibold">Quiz history</h2>
        {data.quizHistory.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No quizzes taken yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.quizHistory.map((q) => (
              <li key={q.id} className="flex justify-between text-[var(--text-muted)]">
                <span>{q.kind === "onboarding" ? "Onboarding quiz" : "Pick next show"}</span>
                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
