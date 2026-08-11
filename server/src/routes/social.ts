import { Router } from "express";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { toApiTitleFromSeed, getAllTitleSeeds } from "../lib/titles";
import { getLatestTagProfile, getSwipedTitleIds } from "../lib/userProfile";
import { getActiveWeights } from "../lib/learnedWeights";
import { sendNotificationEmail } from "../lib/email";
import { getBlockedUserIds, isBlocked, areFriends, canInteract, CHAT_SIMILARITY_THRESHOLD } from "../lib/social";
import { compareProfiles, mergeProfiles, buildDeck } from "@watch-recommender/shared";

export const socialRouter = Router();

const PUBLIC_USER_SELECT = { id: true, username: true, avatarUrl: true, createdAt: true } as const;

async function topTagsFor(userId: string) {
  const profile = await getLatestTagProfile(userId, "onboarding");
  if (!profile) return [];
  return Object.entries(profile.tagProfile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, weight]) => ({ tag, weight }));
}

// ---------- Discovery ----------

/** Top 5 most similar discoverable users — algorithmic suggested matches. */
socialRouter.get("/suggested", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const myProfile = await getLatestTagProfile(myId, "onboarding");
  if (!myProfile) return res.json({ users: [] });

  const [blockedIds, candidates] = await Promise.all([
    getBlockedUserIds(myId),
    prisma.user.findMany({
      where: { id: { not: myId }, discoverable: true, username: { not: null } },
      select: { id: true, username: true, avatarUrl: true },
    }),
  ]);

  const scored = await Promise.all(
    candidates
      .filter((c) => !blockedIds.has(c.id))
      .map(async (c) => {
        const theirProfile = await getLatestTagProfile(c.id, "onboarding");
        const similarity = theirProfile ? compareProfiles(myProfile.tagProfile, theirProfile.tagProfile) : 0;
        return { ...c, similarity };
      }),
  );

  const top = scored
    .filter((c) => c.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  res.json({ users: top });
});

/** Search discoverable usernames. Excludes anyone blocked in either direction, per spec. */
socialRouter.get("/search", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json({ users: [] });

  const myProfile = await getLatestTagProfile(myId, "onboarding");
  const blockedIds = await getBlockedUserIds(myId);

  const candidates = await prisma.user.findMany({
    where: { id: { not: myId }, discoverable: true, username: { contains: q, mode: "insensitive" } },
    select: { id: true, username: true, avatarUrl: true },
    take: 20,
  });

  const results = await Promise.all(
    candidates
      .filter((c) => !blockedIds.has(c.id))
      .map(async (c) => {
        const theirProfile = myProfile ? await getLatestTagProfile(c.id, "onboarding") : null;
        const similarity = myProfile && theirProfile ? compareProfiles(myProfile.tagProfile, theirProfile.tagProfile) : 0;
        return { ...c, similarity };
      }),
  );

  res.json({ users: results });
});

/** Public taste-twin profile. Full watchlist only for self or an accepted friend. */
socialRouter.get("/users/:username", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const username = String(req.params.username);
  const user = await prisma.user.findUnique({ where: { username }, select: PUBLIC_USER_SELECT });
  if (!user) return res.status(404).json({ error: "User not found" });

  const isSelf = user.id === myId;
  if (!isSelf && (await isBlocked(myId, user.id))) {
    return res.status(404).json({ error: "User not found" });
  }

  const [topTags, ratings, friends, interaction] = await Promise.all([
    topTagsFor(user.id),
    prisma.rating.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { title: { select: { name: true } } },
    }),
    isSelf ? true : areFriends(myId, user.id),
    isSelf ? { eligible: false, similarity: 1 } : canInteract(myId, user.id),
  ]);

  let watchlist: unknown[] = [];
  if (isSelf || friends) {
    const actions = await prisma.userTitleAction.findMany({
      where: { userId: user.id, action: { in: ["like", "super_like"] } },
      orderBy: { createdAt: "asc" },
      include: { title: true },
    });
    const latestByTitle = new Map<string, (typeof actions)[number]>();
    for (const a of actions) latestByTitle.set(a.titleId, a);
    watchlist = [...latestByTitle.values()].map((a) => ({ id: a.title.id, name: a.title.name, posterUrl: a.title.posterUrl }));
  }

  res.json({
    user,
    topTags,
    ratings: ratings.map((r) => ({ titleId: r.titleId, titleName: r.title.name, rating: r.rating, comment: r.comment })),
    isFriend: isSelf ? false : friends,
    isSelf,
    similarity: interaction.similarity,
    // reuses the exact same eligibility check message-send/watch-together enforce server-side,
    // so the UI never shows an action that would then 403.
    canChat: interaction.eligible,
    watchlist,
  });
});

// ---------- Friends ----------

socialRouter.post("/friends/:userId/request", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  if (otherId === myId) return res.status(400).json({ error: "Can't friend yourself" });
  if (await isBlocked(myId, otherId)) return res.status(403).json({ error: "Not available" });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: myId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: myId },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: "A friend request already exists" });

  const friendship = await prisma.friendship.create({ data: { requesterId: myId, addresseeId: otherId } });
  res.status(201).json({ id: friendship.id, status: friendship.status });
});

socialRouter.post("/friends/:userId/respond", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  const { accept } = req.body ?? {};
  if (typeof accept !== "boolean") return res.status(400).json({ error: "accept must be a boolean" });

  const friendship = await prisma.friendship.findFirst({
    where: { requesterId: otherId, addresseeId: myId, status: "PENDING" },
  });
  if (!friendship) return res.status(404).json({ error: "No pending request from that user" });

  if (accept) {
    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
  } else {
    await prisma.friendship.delete({ where: { id: friendship.id } });
  }
  res.json({ ok: true });
});

socialRouter.get("/friends", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: myId }, { addresseeId: myId }] },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: PUBLIC_USER_SELECT },
      addressee: { select: PUBLIC_USER_SELECT },
    },
  });

  const accepted = rows
    .filter((r) => r.status === "ACCEPTED")
    .map((r) => (r.requesterId === myId ? r.addressee : r.requester));
  const incoming = rows
    .filter((r) => r.status === "PENDING" && r.addresseeId === myId)
    .map((r) => ({ id: r.id, user: r.requester }));
  const outgoing = rows
    .filter((r) => r.status === "PENDING" && r.requesterId === myId)
    .map((r) => ({ id: r.id, user: r.addressee }));

  res.json({ friends: accepted, incomingRequests: incoming, outgoingRequests: outgoing });
});

// ---------- Block / Report ----------

socialRouter.get("/blocked", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.block.findMany({
    where: { blockerId: req.user!.userId },
    include: { blocked: { select: PUBLIC_USER_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ blocked: rows.map((r) => r.blocked) });
});

socialRouter.post("/block/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  if (otherId === myId) return res.status(400).json({ error: "Can't block yourself" });
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: myId, blockedId: otherId } },
    create: { blockerId: myId, blockedId: otherId },
    update: {},
  });
  res.status(201).json({ ok: true });
});

socialRouter.delete("/block/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  await prisma.block.deleteMany({ where: { blockerId: myId, blockedId: otherId } });
  res.json({ ok: true });
});

/** Reporting immediately blocks the reported user for the reporter, then queues for admin
 * review — the two effects a single Report row is documented to have. */
socialRouter.post("/report/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  const { reason } = req.body ?? {};
  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "reason is required" });
  }
  if (otherId === myId) return res.status(400).json({ error: "Can't report yourself" });

  const target = await prisma.user.findUnique({ where: { id: otherId } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const [report] = await prisma.$transaction([
    prisma.report.create({ data: { reporterId: myId, reportedUserId: otherId, reason: reason.trim() } }),
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: myId, blockedId: otherId } },
      create: { blockerId: myId, blockedId: otherId },
      update: {},
    }),
  ]);
  res.status(201).json({ id: report.id });
});

// ---------- Chat ----------

socialRouter.get("/conversations", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: myId }, { recipientId: myId }] },
    orderBy: { createdAt: "desc" },
    include: {
      sender: { select: PUBLIC_USER_SELECT },
      recipient: { select: PUBLIC_USER_SELECT },
    },
  });

  const byPartner = new Map<string, { partner: (typeof messages)[number]["sender"]; lastMessage: (typeof messages)[number]; unread: number }>();
  for (const m of messages) {
    const partner = m.senderId === myId ? m.recipient : m.sender;
    const existing = byPartner.get(partner.id);
    const isUnread = m.recipientId === myId && !m.readAt;
    if (!existing) {
      byPartner.set(partner.id, { partner, lastMessage: m, unread: isUnread ? 1 : 0 });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }

  res.json({
    conversations: [...byPartner.values()].map((c) => ({
      partner: c.partner,
      lastMessage: { content: c.lastMessage.content, createdAt: c.lastMessage.createdAt },
      unread: c.unread,
    })),
  });
});

socialRouter.get("/messages/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, recipientId: otherId },
        { senderId: otherId, recipientId: myId },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { sharedTitle: true },
  });

  await prisma.message.updateMany({
    where: { senderId: otherId, recipientId: myId, readAt: null },
    data: { readAt: new Date() },
  });

  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
      sharedTitle: m.sharedTitle ? toApiTitleFromSeed({
        id: m.sharedTitle.id,
        name: m.sharedTitle.name,
        type: m.sharedTitle.type as any,
        plot_summary: m.sharedTitle.plotSummary,
        cast: JSON.parse(m.sharedTitle.cast),
        seasons: m.sharedTitle.seasons,
        episodes: m.sharedTitle.episodes,
        runtime_minutes: m.sharedTitle.runtimeMinutes,
        release_year: m.sharedTitle.releaseYear,
        platforms: JSON.parse(m.sharedTitle.platforms),
        languages: JSON.parse(m.sharedTitle.languages),
        poster_url: m.sharedTitle.posterUrl,
        tags: JSON.parse(m.sharedTitle.tags),
      }) : null,
    })),
  });
});

socialRouter.post("/messages/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  const { content, sharedTitleId } = req.body ?? {};
  if (typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "content is required" });
  }

  const { eligible } = await canInteract(myId, otherId);
  if (!eligible) {
    return res.status(403).json({ error: "You can only message taste twins or friends" });
  }

  const message = await prisma.message.create({
    data: { senderId: myId, recipientId: otherId, content: content.trim(), sharedTitleId: sharedTitleId || null },
  });

  const [me, recipient] = await Promise.all([
    prisma.user.findUnique({ where: { id: myId } }),
    prisma.user.findUnique({ where: { id: otherId } }),
  ]);
  if (recipient) {
    sendNotificationEmail(
      recipient.email,
      `New message from ${me?.username ?? "a taste twin"}`,
      content.trim(),
    ).catch(() => {});
  }

  res.status(201).json({ id: message.id, createdAt: message.createdAt });
});

// ---------- Watch Together ----------

socialRouter.post("/watch-together/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const otherId = String(req.params.userId);
  const { eligible } = await canInteract(myId, otherId);
  if (!eligible) return res.status(403).json({ error: "You can only watch together with taste twins or friends" });

  const [myProfile, theirProfile] = await Promise.all([
    getLatestTagProfile(myId, "onboarding"),
    getLatestTagProfile(otherId, "onboarding"),
  ]);
  if (!myProfile || !theirProfile) {
    return res.status(409).json({ error: "Both users must complete onboarding first" });
  }

  const merged = mergeProfiles(myProfile.tagProfile, theirProfile.tagProfile);
  const session = await prisma.watchTogetherSession.create({
    data: { initiatorId: myId, partnerId: otherId, mergedProfile: JSON.stringify(merged) },
  });
  res.status(201).json({ id: session.id });
});

async function watchTogetherDeck(sessionId: string, mergedProfile: Record<string, number>) {
  const excludedIds = await prisma.userTitleAction
    .findMany({ where: { watchTogetherSessionId: sessionId }, select: { titleId: true } })
    .then((rows) => new Set(rows.map((r) => r.titleId)));
  const learnedWeights = await getActiveWeights();
  const deck = buildDeck(mergedProfile, await getAllTitleSeeds(), {
    excludedIds,
    learnedWeights: learnedWeights ?? undefined,
  });
  return deck.map(toApiTitleFromSeed);
}

socialRouter.get("/watch-together/:sessionId", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const sessionId = String(req.params.sessionId);
  const session = await prisma.watchTogetherSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.initiatorId !== myId && session.partnerId !== myId) {
    return res.status(403).json({ error: "Not your session" });
  }

  const mergedProfile = JSON.parse(session.mergedProfile);
  const deck = await watchTogetherDeck(session.id, mergedProfile);

  // last action per title wins (append-only log) — same dedup pattern as the personal
  // watchlist (routes/watchlist.ts): a later pass removes a title even after a like.
  const allActions = await prisma.userTitleAction.findMany({
    where: { watchTogetherSessionId: session.id },
    orderBy: { createdAt: "asc" },
    include: { title: true },
  });
  const latestByTitle = new Map<string, (typeof allActions)[number]>();
  for (const a of allActions) latestByTitle.set(a.titleId, a);
  const jointWatchlist = [...latestByTitle.values()].filter((a) => a.action === "like" || a.action === "super_like");

  res.json({
    id: session.id,
    deck,
    watchlist: jointWatchlist.map((a) => ({ id: a.title.id, name: a.title.name, posterUrl: a.title.posterUrl })),
  });
});

socialRouter.post("/watch-together/:sessionId/actions", requireAuth, async (req: AuthedRequest, res) => {
  const myId = req.user!.userId;
  const { titleId, action } = req.body ?? {};
  const VALID_ACTIONS = new Set(["pass", "like", "super_like"]);
  if (typeof titleId !== "string" || typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return res.status(400).json({ error: "titleId and a valid action are required" });
  }

  const sessionId = String(req.params.sessionId);
  const session = await prisma.watchTogetherSession.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.initiatorId !== myId && session.partnerId !== myId) {
    return res.status(403).json({ error: "Not your session" });
  }

  const created = await prisma.userTitleAction.create({
    data: { userId: myId, titleId, action: action as any, watchTogetherSessionId: session.id },
  });
  res.status(201).json({ id: created.id });
});
