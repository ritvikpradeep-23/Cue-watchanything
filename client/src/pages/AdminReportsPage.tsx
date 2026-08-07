import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

interface ReportRow {
  id: string;
  reporterEmail: string;
  reportedUserEmail: string;
  reason: string;
  status: "PENDING" | "REVIEWED";
  createdAt: string;
  reviewedAt: string | null;
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  function load() {
    setReports(null);
    apiGet<{ reports: ReportRow[] }>(`/admin/reports${showAll ? "?status=all" : ""}`).then((res) =>
      setReports(res.reports),
    );
  }

  useEffect(load, [showAll]);

  async function resolve(id: string) {
    await apiPost(`/admin/reports/${id}/resolve`, {});
    load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-semibold sm:text-4xl">Reports</h1>
          <p className="text-sm font-bold text-[var(--text-muted)]">User-filed reports queued for review.</p>
        </div>
        <button
          onClick={() => setShowAll((s) => !s)}
          className={`chip px-3 py-1.5 text-xs ${showAll ? "bg-accent-500 text-[var(--on-accent)]" : "bg-[var(--bg-elevated)]"}`}
        >
          {showAll ? "Showing all" : "Showing pending"}
        </button>
      </div>

      {!reports ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <p className="surface p-6 text-center text-sm font-semibold text-[var(--text-muted)]">
          Nothing to review.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="surface bg-[var(--bg-elevated)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    {r.reporterEmail} reported {r.reportedUserEmail}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{r.reason}</p>
                  <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.status === "REVIEWED" && r.reviewedAt && ` · reviewed ${new Date(r.reviewedAt).toLocaleDateString()}`}
                  </p>
                </div>
                {r.status === "PENDING" ? (
                  <button
                    onClick={() => resolve(r.id)}
                    className="surface-interactive shrink-0 bg-accent-500 px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
                  >
                    Mark reviewed
                  </button>
                ) : (
                  <span className="chip shrink-0 bg-[var(--bg-sunken)] px-2 py-1 text-[10px]">Reviewed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
