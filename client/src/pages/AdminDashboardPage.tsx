import { useEffect, useState } from "react";
import { apiGet, ApiError } from "../lib/api";

interface AdminStats {
  totalUsers: number;
  totalTitles: number;
  signupsByDay: { day: string; count: number }[];
  quizCompletion: { usersCompleted: number; totalUsers: number; rate: number };
  activity: { swipes: number; watched: number; ratings: number; reviews: number };
  mostLiked: { titleId: string; name: string; count: number }[];
  mostWatched: { titleId: string; name: string; count: number }[];
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pop-panel bg-[var(--bg-elevated)] p-4 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function RankedList({ title, items }: { title: string; items: { name: string; count: number }[] }) {
  return (
    <div className="pop-panel bg-[var(--bg-elevated)] p-5">
      <h3 className="mb-3 text-sm font-black uppercase tracking-wide">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Not enough activity yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={item.name + i} className="flex items-center justify-between text-sm">
              <span className="font-bold">
                {i + 1}. {item.name}
              </span>
              <span className="pop-badge bg-accent-500 px-2 py-0.5 text-[10px] text-[var(--ink)]">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load stats"));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="pop-panel p-6 font-bold text-red-600">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  const recentSignups = stats.signupsByDay.slice(-14);
  const maxSignups = Math.max(1, ...recentSignups.map((d) => d.count));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-black uppercase sm:text-4xl">Admin dashboard</h1>
      <p className="mb-8 text-sm font-bold text-[var(--text-muted)]">Internal-only — not visible to regular users.</p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total users" value={stats.totalUsers} />
        <StatTile label="Total titles" value={stats.totalTitles} />
        <StatTile label="Quiz completion" value={`${Math.round(stats.quizCompletion.rate * 100)}%`} />
        <StatTile label="Total swipes" value={stats.activity.swipes} />
        <StatTile label="Watched" value={stats.activity.watched} />
        <StatTile label="Ratings" value={stats.activity.ratings} />
        <StatTile label="Reviews (with comment)" value={stats.activity.reviews} />
        <StatTile
          label="Onboarded users"
          value={`${stats.quizCompletion.usersCompleted}/${stats.quizCompletion.totalUsers}`}
        />
      </div>

      <div className="pop-panel mb-8 bg-[var(--bg-elevated)] p-5">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wide">Signups (last 14 days with activity)</h3>
        {recentSignups.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No signups recorded yet.</p>
        ) : (
          <div className="flex items-end gap-2" style={{ height: 100 }}>
            {recentSignups.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
                <div
                  className="w-full rounded-t-md bg-accent-500"
                  style={{ height: `${Math.max(6, (d.count / maxSignups) * 80)}px` }}
                />
                <span className="text-[9px] font-bold text-[var(--text-muted)]">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <RankedList title="Most liked / super-liked" items={stats.mostLiked} />
        <RankedList title="Most watched" items={stats.mostWatched} />
      </div>
    </div>
  );
}
