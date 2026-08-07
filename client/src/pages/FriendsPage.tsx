import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UsernameGate } from "../components/UsernameGate";
import { apiGet, apiPost } from "../lib/api";

interface PublicUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface FriendsData {
  friends: PublicUser[];
  incomingRequests: { id: string; user: PublicUser }[];
  outgoingRequests: { id: string; user: PublicUser }[];
}

function UserRow({ u }: { u: PublicUser }) {
  return (
    <Link to={`/twins/${u.username}`} className="surface-interactive flex items-center gap-3 bg-[var(--bg-elevated)] p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500 text-xs font-semibold text-[var(--on-accent)]">
        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" /> : u.username[0]?.toUpperCase()}
      </div>
      <p className="text-sm font-bold">{u.username}</p>
    </Link>
  );
}

function FriendsPageInner() {
  const [data, setData] = useState<FriendsData | null>(null);

  function load() {
    apiGet<FriendsData>("/social/friends").then(setData);
  }

  useEffect(load, []);

  async function respond(requesterId: string, accept: boolean) {
    await apiPost(`/social/friends/${requesterId}/respond`, { accept });
    load();
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
      <h1 className="mb-6 text-3xl font-semibold sm:text-4xl">Friends</h1>

      {data.incomingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Requests</h2>
          <div className="flex flex-col gap-2">
            {data.incomingRequests.map((r) => (
              <div key={r.id} className="surface flex items-center justify-between gap-3 bg-[var(--bg-elevated)] p-3">
                <span className="text-sm font-bold">{r.user.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(r.user.id, true)}
                    className="surface-interactive bg-accent-500 px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(r.user.id, false)}
                    className="surface-interactive bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.outgoingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Sent</h2>
          <div className="flex flex-col gap-2">
            {data.outgoingRequests.map((r) => (
              <div key={r.id} className="surface flex items-center justify-between gap-3 bg-[var(--bg-elevated)] p-3">
                <span className="text-sm font-bold">{r.user.username}</span>
                <span className="chip bg-[var(--bg-sunken)] px-2 py-1 text-[10px]">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">
        Your friends {data.friends.length > 0 && `(${data.friends.length})`}
      </h2>
      {data.friends.length === 0 ? (
        <p className="surface p-4 text-sm font-semibold text-[var(--text-muted)]">
          No friends yet.{" "}
          <Link to="/twins" className="font-bold text-[var(--text-accent)] underline">
            Find taste twins
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.friends.map((u) => (
            <UserRow key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FriendsPage() {
  return (
    <UsernameGate>
      <FriendsPageInner />
    </UsernameGate>
  );
}
