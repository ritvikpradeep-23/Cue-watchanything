import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

interface UserRow {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  bannedAt: string | null;
}

interface UserDetail {
  user: UserRow;
  actions: { id: string; titleId: string; titleName: string; action: string; createdAt: string }[];
  ratings: { id: string; titleId: string; titleName: string; rating: number; comment: string | null; createdAt: string }[];
  quizResponses: { id: string; kind: string; createdAt: string; watchedTitleId: string | null }[];
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [confirmingBanId, setConfirmingBanId] = useState<string | null>(null);

  function loadUsers() {
    setUsers(null);
    apiGet<{ users: UserRow[]; total: number }>(`/admin/users?page=${page}&query=${encodeURIComponent(query)}`).then(
      (res) => {
        setUsers(res.users);
        setTotal(res.total);
      },
    );
  }

  useEffect(loadUsers, [page, query]);

  function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    apiGet<UserDetail>(`/admin/users/${id}`).then(setDetail);
  }

  async function setRole(id: string, role: "USER" | "ADMIN") {
    await apiPost(`/admin/users/${id}/role`, { role });
    loadUsers();
    if (selectedId === id) openDetail(id);
  }

  async function ban(id: string) {
    await apiPost(`/admin/users/${id}/ban`, {});
    setConfirmingBanId(null);
    loadUsers();
    if (selectedId === id) openDetail(id);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Users</h1>
      <p className="mb-6 text-sm font-bold text-[var(--text-muted)]">{total} accounts</p>

      <input
        value={query}
        onChange={(e) => {
          setPage(1);
          setQuery(e.target.value);
        }}
        placeholder="Search by email…"
        className="mb-6 w-full max-w-sm rounded-xl border-2 border-[var(--ink)] bg-transparent px-4 py-2 text-sm outline-none"
      />

      {!users ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        </div>
      ) : (
        <div className="surface overflow-hidden bg-[var(--bg-elevated)]">
          {users.map((u) => (
            <div key={u.id} className="border-b border-[var(--border)]/10 last:border-0">
              <button
                onClick={() => (selectedId === u.id ? setSelectedId(null) : openDetail(u.id))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-sunken)]/40"
              >
                <div>
                  <p className="text-sm font-bold">{u.email}</p>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {u.bannedAt && (
                    <span className="chip bg-red-600 px-2 py-0.5 text-[10px] text-white">Banned</span>
                  )}
                  {u.role === "ADMIN" && (
                    <span className="chip bg-accent-500 px-2 py-0.5 text-[10px] text-[var(--on-accent)]">Admin</span>
                  )}
                </div>
              </button>

              {selectedId === u.id && (
                <div className="border-t border-[var(--border)]/10 bg-[var(--bg-sunken)]/20 p-4">
                  {!detail ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  ) : (
                    <>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {u.role === "ADMIN" ? (
                          <button
                            onClick={() => setRole(u.id, "USER")}
                            className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold"
                          >
                            Revoke admin
                          </button>
                        ) : (
                          <button
                            onClick={() => setRole(u.id, "ADMIN")}
                            className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold"
                          >
                            Grant admin
                          </button>
                        )}
                        {!u.bannedAt &&
                          (confirmingBanId === u.id ? (
                            <>
                              <button
                                onClick={() => ban(u.id)}
                                className="surface-interactive bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Confirm permanent ban
                              </button>
                              <button
                                onClick={() => setConfirmingBanId(null)}
                                className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmingBanId(u.id)}
                              className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-red-600"
                            >
                              Ban permanently
                            </button>
                          ))}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <p className="mb-2 text-xs font-bold tracking-wide text-[var(--text-muted)]">
                            Recent activity ({detail.actions.length})
                          </p>
                          <ul className="flex flex-col gap-1 text-xs">
                            {detail.actions.slice(0, 10).map((a) => (
                              <li key={a.id} className="text-[var(--text-muted)]">
                                <span className="font-bold text-[var(--text)]">{a.action}</span> {a.titleName}
                              </li>
                            ))}
                            {detail.actions.length === 0 && <li className="text-[var(--text-muted)]">None</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-bold tracking-wide text-[var(--text-muted)]">
                            Ratings ({detail.ratings.length})
                          </p>
                          <ul className="flex flex-col gap-1 text-xs">
                            {detail.ratings.map((r) => (
                              <li key={r.id} className="text-[var(--text-muted)]">
                                <span className="font-bold text-[var(--text)]">{"★".repeat(r.rating)}</span> {r.titleName}
                              </li>
                            ))}
                            {detail.ratings.length === 0 && <li className="text-[var(--text-muted)]">None</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-bold tracking-wide text-[var(--text-muted)]">
                            Quiz history ({detail.quizResponses.length})
                          </p>
                          <ul className="flex flex-col gap-1 text-xs">
                            {detail.quizResponses.map((q) => (
                              <li key={q.id} className="text-[var(--text-muted)]">
                                {q.kind === "onboarding" ? "Onboarding" : "Pick next show"} —{" "}
                                {new Date(q.createdAt).toLocaleDateString()}
                              </li>
                            ))}
                            {detail.quizResponses.length === 0 && <li className="text-[var(--text-muted)]">None</li>}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-xs font-bold text-[var(--text-muted)]">Page {page}</span>
        <button
          disabled={page * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
