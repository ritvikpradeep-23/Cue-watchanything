import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { UsernameGate } from "../components/UsernameGate";
import { apiDelete, apiGet, apiPost, ApiError } from "../lib/api";

interface TwinProfile {
  user: { id: string; username: string; avatarUrl: string | null; createdAt: string };
  topTags: { tag: string; weight: number }[];
  ratings: { titleId: string; titleName: string; rating: number; comment: string | null }[];
  isFriend: boolean;
  pendingOutgoingRequest: boolean;
  isSelf: boolean;
  similarity: number;
  canChat: boolean;
  watchlist: { id: string; name: string; posterUrl: string }[];
}

function TwinProfilePageInner() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<TwinProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmingReport, setConfirmingReport] = useState(false);
  const [reportReason, setReportReason] = useState("");

  function load() {
    if (!username) return;
    apiGet<TwinProfile>(`/social/users/${username}`)
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  }

  useEffect(load, [username]);

  async function sendFriendRequest() {
    if (!profile) return;
    try {
      await apiPost(`/social/friends/${profile.user.id}/request`, {});
      setStatus("Friend request sent");
      load();
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Failed to send friend request");
    }
  }

  async function cancelFriendRequest() {
    if (!profile) return;
    await apiDelete(`/social/friends/${profile.user.id}/request`);
    setStatus(null);
    load();
  }

  async function startWatchTogether() {
    if (!profile) return;
    const res = await apiPost<{ id: string }>(`/social/watch-together/${profile.user.id}`, {});
    navigate(`/watch-together/${res.id}`);
  }

  async function submitReport() {
    if (!profile) return;
    try {
      await apiPost(`/social/report/${profile.user.id}`, { reason: reportReason });
      setStatus("Reported and blocked");
      setConfirmingReport(false);
      load();
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Failed to report");
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="surface p-6 font-normal text-[var(--text-muted)]">
          That user isn't available — they may not exist, or you may have blocked each other.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500 text-xl font-semibold text-[var(--on-accent)]">
          {profile.user.avatarUrl ? (
            <img src={profile.user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            profile.user.username[0]?.toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{profile.user.username}</h1>
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Joined {new Date(profile.user.createdAt).toLocaleDateString()}
            {!profile.isSelf && ` · ${Math.round(profile.similarity * 100)}% match`}
          </p>
        </div>
      </div>

      {!profile.isSelf && (
        <div className="mb-6 flex flex-wrap gap-2">
          {profile.canChat && (
            <Link
              to={`/chat/${profile.user.id}`}
              className="surface-interactive bg-accent-500 px-4 py-2 text-sm font-medium text-[var(--on-accent)]"
            >
              Message
            </Link>
          )}
          {!profile.isFriend && !profile.pendingOutgoingRequest && (
            <button onClick={sendFriendRequest} className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium">
              Add friend
            </button>
          )}
          {!profile.isFriend && profile.pendingOutgoingRequest && (
            <button onClick={cancelFriendRequest} className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium">
              Cancel friend request
            </button>
          )}
          {profile.canChat && (
            <button onClick={startWatchTogether} className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium">
              Watch together
            </button>
          )}
          <button
            onClick={() => setConfirmingReport(true)}
            className="surface-interactive bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-accent)]"
          >
            Report
          </button>
        </div>
      )}

      {status && <p className="mb-4 text-sm font-medium text-[var(--text-accent)]">{status}</p>}

      {confirmingReport && (
        <div className="surface mb-6 flex flex-col gap-3 bg-[var(--bg-elevated)] p-4">
          <p className="text-sm font-normal">Reporting blocks this user for you and queues it for admin review.</p>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="What happened?"
            rows={3}
            className="w-full rounded-xl border-2 border-[var(--ink)] bg-transparent p-3 text-sm outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={submitReport}
              disabled={!reportReason.trim()}
              className="surface-interactive bg-accent-600 px-3 py-1.5 text-xs font-medium text-[var(--on-accent)] disabled:opacity-50"
            >
              Submit report
            </button>
            <button
              onClick={() => setConfirmingReport(false)}
              className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="surface mb-6 bg-[var(--bg-elevated)] p-5">
        <h2 className="mb-3 text-sm font-medium tracking-wide">Taste profile</h2>
        {profile.topTags.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No taste profile yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.topTags.map((t) => (
              <span key={t.tag} className="chip bg-accent-500 px-3 py-1 text-xs text-[var(--on-accent)]">
                {t.tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {(profile.isFriend || profile.isSelf) && profile.watchlist.length > 0 && (
        <div className="surface mb-6 bg-[var(--bg-elevated)] p-5">
          <h2 className="mb-3 text-sm font-medium tracking-wide">Watchlist</h2>
          <div className="flex flex-wrap gap-2">
            {profile.watchlist.map((t) => (
              <Link key={t.id} to={`/titles/${t.id}`} className="text-xs font-normal text-[var(--text-accent)] hover:underline">
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="surface bg-[var(--bg-elevated)] p-5">
        <h2 className="mb-3 text-sm font-medium tracking-wide">Ratings & reviews</h2>
        {profile.ratings.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No ratings yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.ratings.map((r) => (
              <div key={r.titleId} className="text-sm">
                <span className="font-medium text-[var(--text-accent)]">{"★".repeat(r.rating)}</span> {r.titleName}
                {r.comment && <p className="mt-0.5 text-[var(--text-muted)]">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TwinProfilePage() {
  return (
    <UsernameGate>
      <TwinProfilePageInner />
    </UsernameGate>
  );
}
