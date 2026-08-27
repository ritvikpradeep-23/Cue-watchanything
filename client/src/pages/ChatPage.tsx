import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { UsernameGate } from "../components/UsernameGate";
import { apiGet, apiPost } from "../lib/api";

interface Conversation {
  partner: { id: string; username: string; avatarUrl: string | null };
  lastMessage: { content: string; createdAt: string };
  unread: number;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sharedTitle: { id: string; name: string; posterUrl: string } | null;
}

function ChatPageInner() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [shareTitleId, setShareTitleId] = useState("");
  const [myWatchlist, setMyWatchlist] = useState<{ id: string; name: string }[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ user: { id: string } }>("/profile").then((res) => setMyId(res.user.id));
    apiGet<{ items: { id: string; name: string }[] }>("/watchlist").then((res) =>
      setMyWatchlist(res.items.map((t) => ({ id: t.id, name: t.name }))),
    );
  }, []);

  useEffect(() => {
    apiGet<{ conversations: Conversation[] }>("/social/conversations").then((res) => setConversations(res.conversations));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setMessages(null);
      return;
    }
    apiGet<{ messages: Message[] }>(`/social/messages/${userId}`).then((res) => setMessages(res.messages));
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!userId || !draft.trim()) return;
    const content = draft.trim();
    const sharedTitleId = shareTitleId || undefined;
    setDraft("");
    setShareTitleId("");
    await apiPost(`/social/messages/${userId}`, { content, sharedTitleId });
    apiGet<{ messages: Message[] }>(`/social/messages/${userId}`).then((res) => setMessages(res.messages));
    apiGet<{ conversations: Conversation[] }>("/social/conversations").then((res) => setConversations(res.conversations));
  }

  const activePartner = conversations?.find((c) => c.partner.id === userId)?.partner;

  return (
    <div className="mx-auto flex h-[75vh] max-w-4xl gap-4 px-4 py-10">
      <div className="surface w-64 shrink-0 overflow-y-auto bg-[var(--bg-elevated)]">
        {!conversations ? (
          <div className="p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-xs font-normal text-[var(--text-muted)]">
            No conversations yet. Message a{" "}
            <Link to="/twins" className="font-medium text-[var(--text-accent)] hover:underline">
              taste twin
            </Link>{" "}
            from their profile.
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.partner.id}
              onClick={() => navigate(`/chat/${c.partner.id}`)}
              className={`flex w-full items-center justify-between gap-2 border-b border-[var(--border)]/10 px-4 py-3 text-left hover:bg-[var(--bg-sunken)]/40 ${
                userId === c.partner.id ? "bg-[var(--bg-sunken)]/40" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.partner.username}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{c.lastMessage.content}</p>
              </div>
              {c.unread > 0 && (
                <span className="chip shrink-0 bg-accent-500 px-1.5 py-0.5 text-[10px] text-[var(--on-accent)]">{c.unread}</span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="surface flex flex-1 flex-col bg-[var(--bg-elevated)]">
        {!userId ? (
          <div className="flex flex-1 items-center justify-center text-sm font-normal text-[var(--text-muted)]">
            Select a conversation
          </div>
        ) : (
          <>
            {activePartner && (
              <div className="border-b border-[var(--border)]/10 p-3">
                <Link to={`/twins/${activePartner.username}`} className="text-sm font-medium hover:text-[var(--text-accent)]">
                  {activePartner.username}
                </Link>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              {!messages ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                        m.senderId === myId
                          ? "self-end bg-accent-500 text-[var(--on-accent)]"
                          : "self-start bg-[var(--bg-sunken)]"
                      }`}
                    >
                      {m.sharedTitle && (
                        <Link
                          to={`/titles/${m.sharedTitle.id}`}
                          className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 p-1.5"
                        >
                          <img src={m.sharedTitle.posterUrl} alt="" className="h-10 w-7 rounded object-cover" />
                          <span className="text-xs font-medium">{m.sharedTitle.name}</span>
                        </Link>
                      )}
                      {m.content}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
            <div className="border-t border-[var(--border)]/10 p-3">
              {myWatchlist.length > 0 && (
                <select
                  value={shareTitleId}
                  onChange={(e) => setShareTitleId(e.target.value)}
                  className="mb-2 w-full rounded-xl border-2 border-[var(--ink)] bg-transparent px-3 py-1.5 text-xs outline-none"
                >
                  <option value="">Share a title from your watchlist (optional)</option>
                  {myWatchlist.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Message…"
                  className="flex-1 rounded-xl border-2 border-[var(--ink)] bg-transparent px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={send}
                  className="surface-interactive bg-accent-500 px-4 py-2 text-sm font-medium text-[var(--on-accent)]"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ChatPage() {
  return (
    <UsernameGate>
      <ChatPageInner />
    </UsernameGate>
  );
}
