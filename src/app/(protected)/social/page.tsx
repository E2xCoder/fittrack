"use client";

import { useEffect, useState } from "react";
import { METRICS } from "@/lib/metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FriendData {
  friendshipId:      string;
  userId:            string;
  name:              string;
  username:          string | null;
  streak:            number | null;
  weeklyStepsAvg:    number | null;
  weeklyCaloriesAvg: number | null;
  isGymDay:          boolean | null;
  gymSplit:          string | null;
  lastLogDate:       string | null;
  isStreakDanger:    boolean;
}

interface IncomingRequest {
  id:        string;
  userId:    string;
  name:      string;
  username:  string | null;
  createdAt: string;
}

interface OutgoingRequest {
  id:       string;
  friendId: string;
  name:     string;
  username: string | null;
  status:   string;
}

interface LeaderboardEntry {
  userId:   string;
  name:     string;
  username: string | null;
  steps:    number;
  isMe:     boolean;
}

interface SearchUser {
  id:           string;
  name:         string | null;
  username:     string | null;
  friendshipId: string | null;
  status:       string | null;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-red-600","bg-orange-600","bg-yellow-600","bg-green-600",
  "bg-teal-600","bg-blue-600","bg-indigo-600","bg-pink-600",
  "bg-purple-600","bg-rose-600",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm";
  return (
    <div className={`shrink-0 ${dim} ${avatarColor(name)} flex items-center justify-center rounded-full font-bold text-white`}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return "Hic aktif olmadi";
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 3600)    return `${Math.round(diff / 60)} dk once`;
  if (diff < 86400)   return `${Math.round(diff / 3600)} saat once`;
  const days = Math.round(diff / 86400);
  if (days === 1)     return "Dun";
  return `${days} gun once`;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-zinc-800" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/2 rounded bg-zinc-800" />
          <div className="h-2.5 w-1/3 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

// ─── Friend Card ──────────────────────────────────────────────────────────────

function FriendCard({ friend }: { friend: FriendData }) {
  const borderClass = friend.isStreakDanger
    ? "border-red-800/60 bg-zinc-900"
    : "border-zinc-800 bg-zinc-900";

  return (
    <div className={`rounded-xl border p-3 ${borderClass}`}>
      <div className="flex items-start gap-3">
        <Avatar name={friend.name} />

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-white">{friend.name}</span>
            {friend.username && (
              <span className="text-[10px] text-zinc-500">@{friend.username}</span>
            )}
          </div>

          {/* Active time */}
          <p className="text-[10px] text-zinc-500 mb-1.5">
            {relativeTime(friend.lastLogDate)}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {friend.streak !== null && (
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                friend.streak > 0 ? "bg-orange-950/60 text-orange-400" : "bg-zinc-800 text-zinc-500"
              }`}>
                {friend.streak > 0 ? `🔥 ${friend.streak} gün` : "Streak yok"}
              </span>
            )}
            {friend.isGymDay !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                friend.isGymDay
                  ? "bg-green-950/60 text-green-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}>
                {friend.isGymDay ? (friend.gymSplit ?? "Gym") : "Rest"}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3">
            {friend.weeklyStepsAvg !== null && (
              <span className="text-[10px] text-zinc-400">
                <span className="font-semibold tabular-nums" style={{ color: METRICS.steps.hex }}>{friend.weeklyStepsAvg.toLocaleString()}</span> adım/gün
              </span>
            )}
            {friend.weeklyCaloriesAvg !== null && (
              <span className="text-[10px] text-zinc-400">
                <span className="font-semibold tabular-nums" style={{ color: METRICS.calories.hex }}>{friend.weeklyCaloriesAvg}</span> kcal/gün
              </span>
            )}
          </div>

          {/* Streak danger warning */}
          {friend.isStreakDanger && (
            <p className="mt-1.5 text-[10px] font-semibold text-red-400">
              Streaki tehlikede! Haber ver.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [tab, setTab] = useState<"friends" | "challenge" | "discover">("friends");

  // Friends state
  const [friends, setFriends]     = useState<FriendData[]>([]);
  const [incoming, setIncoming]   = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing]   = useState<OutgoingRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // Challenge state
  const [leaderboard, setLeaderboard]     = useState<LeaderboardEntry[]>([]);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [challengeLoading, setChallengeLoading] = useState(true);

  // Discover state
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [sendingReq,    setSendingReq]    = useState<Record<string, boolean>>({});
  const [respondingId,  setRespondingId]  = useState<string | null>(null);

  // ── Fetch friends ──────────────────────────────────────────────────────────

  async function fetchFriends() {
    setFriendsLoading(true);
    try {
      const res  = await fetch("/api/social/friends");
      const data = await res.json();
      setFriends(data.friends  ?? []);
      setIncoming(data.incoming ?? []);
      setOutgoing(data.outgoing ?? []);
    } finally {
      setFriendsLoading(false);
    }
  }

  // ── Fetch challenge ────────────────────────────────────────────────────────

  async function fetchChallenge() {
    setChallengeLoading(true);
    try {
      const res  = await fetch("/api/social/weekly-challenge");
      const data = await res.json();
      setLeaderboard(data.leaderboard   ?? []);
      setDaysRemaining(data.daysRemaining ?? 0);
    } finally {
      setChallengeLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchFriends();
      void fetchChallenge();
    });
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────

  async function doSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res  = await fetch(`/api/social/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } finally {
      setSearching(false);
    }
  }

  // ── Send friend request ────────────────────────────────────────────────────

  async function sendRequest(targetUserId: string) {
    setSendingReq((p) => ({ ...p, [targetUserId]: true }));
    try {
      await fetch("/api/social/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      // Refresh search results so button updates
      if (searchQuery) doSearch(searchQuery);
      fetchFriends();
    } finally {
      setSendingReq((p) => ({ ...p, [targetUserId]: false }));
    }
  }

  // ── Accept / Reject ────────────────────────────────────────────────────────

  async function respond(id: string, action: "accept" | "reject") {
    setRespondingId(id);
    try {
      await fetch(`/api/social/friend-request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchFriends();
    } finally {
      setRespondingId(null);
    }
  }

  // ── Leaderboard rank badge ─────────────────────────────────────────────────

  function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <span className="text-base" aria-label="1. sıra">🥇</span>;
    if (rank === 2) return <span className="text-base" aria-label="2. sıra">🥈</span>;
    if (rank === 3) return <span className="text-base" aria-label="3. sıra">🥉</span>;
    return <span className="text-xs font-bold text-zinc-400">{rank}</span>;
  }

  const maxSteps = leaderboard[0]?.steps ?? 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-2xl p-4 pb-28">
      {/* Header */}
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-green-400/80">Topluluk</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Social</h1>
        <p className="text-xs text-zinc-500">Arkadaşlar &amp; haftalık meydan okuma</p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex rounded-xl bg-zinc-900 p-1">
        {([
          { id: "friends",   label: "Arkadaslar" },
          { id: "challenge", label: "Haftalik" },
          { id: "discover",  label: "Kesfet" },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              tab === id ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
            {id === "friends" && incoming.length > 0 && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                {incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── FRIENDS TAB ── */}
      {tab === "friends" && (
        <div className="space-y-2">
          {/* Pending incoming banner */}
          {incoming.length > 0 && (
            <div className="rounded-xl border border-blue-800/50 bg-blue-950/30 px-3 py-2.5">
              <p className="mb-2 text-xs font-semibold text-blue-300">
                {incoming.length} bekleyen arkadaslik istegi
              </p>
              <div className="space-y-2">
                {incoming.map((req) => (
                  <div key={req.id} className="flex items-center gap-2">
                    <Avatar name={req.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{req.name}</p>
                      {req.username && <p className="text-[10px] text-zinc-500">@{req.username}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => respond(req.id, "accept")}
                        disabled={respondingId === req.id}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                      >
                        Kabul
                      </button>
                      <button
                        onClick={() => respond(req.id, "reject")}
                        disabled={respondingId === req.id}
                        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friend list */}
          {friendsLoading ? (
            <>{[1,2,3].map((i) => <SkeletonCard key={i} />)}</>
          ) : friends.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-3xl">👥</p>
              <p className="mt-2 text-sm font-semibold text-zinc-400">Henuz arkadasin yok</p>
              <button
                onClick={() => setTab("discover")}
                className="mt-3 rounded-xl bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-500"
              >
                Arkadas Bul
              </button>
            </div>
          ) : (
            friends.map((f) => <FriendCard key={f.friendshipId} friend={f} />)
          )}
        </div>
      )}

      {/* ── CHALLENGE TAB ── */}
      {tab === "challenge" && (
        <div>
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-zinc-200">Bu hafta adim siralaması</p>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] text-zinc-400">
              {daysRemaining > 0 ? `${daysRemaining} gun kaldi` : "Bugun son gun"}
            </span>
          </div>

          {challengeLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-zinc-500">Veri yok — arkadas ekle ve haftalik meydan okumaya katil!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => {
                const rank = idx + 1;
                const pct  = maxSteps > 0 ? Math.round((entry.steps / maxSteps) * 100) : 0;
                return (
                  <div
                    key={entry.userId}
                    className={`overflow-hidden rounded-xl border p-3 ${
                      entry.isMe
                        ? "border-green-800/50 bg-green-950/20"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <div className="w-6 shrink-0 text-center">
                        <RankBadge rank={rank} />
                      </div>
                      <Avatar name={entry.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold ${entry.isMe ? "text-green-300" : "text-white"}`}>
                            {entry.isMe ? "Sen" : entry.name}
                          </span>
                          {entry.username && (
                            <span className="text-[10px] text-zinc-600">@{entry.username}</span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-zinc-200">
                        {entry.steps.toLocaleString()}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          rank === 1 ? "bg-yellow-400" :
                          rank === 2 ? "bg-zinc-400"   :
                          rank === 3 ? "bg-orange-500" :
                          entry.isMe ? "bg-green-500"  : "bg-zinc-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DISCOVER TAB ── */}
      {tab === "discover" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              placeholder="@kullanici_adi veya isim ara..."
              value={searchQuery}
              onChange={(e) => doSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Sonuclar</p>
              {searchResults.map((user) => {
                const alreadyFriend = user.status === "accepted";
                const isPending     = user.status === "pending";
                return (
                  <div key={user.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5">
                    <Avatar name={user.name ?? "?"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{user.name}</p>
                      {user.username && (
                        <p className="text-[10px] text-zinc-500">@{user.username}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {alreadyFriend ? (
                        <span className="text-xs text-green-400 font-semibold">Arkadas</span>
                      ) : isPending ? (
                        <span className="text-xs text-zinc-500">Istek gonderildi</span>
                      ) : (
                        <button
                          onClick={() => sendRequest(user.id)}
                          disabled={!!sendingReq[user.id]}
                          className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                        >
                          {sendingReq[user.id] ? "..." : "Arkadas Ekle"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <p className="text-center text-sm text-zinc-500">Kullanici bulunamadi</p>
          )}

          {/* Outgoing pending requests */}
          {outgoing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Gonderilen istekler</p>
              {outgoing.map((req) => (
                <div key={req.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5">
                  <Avatar name={req.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{req.name}</p>
                    {req.username && (
                      <p className="text-[10px] text-zinc-500">@{req.username}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-500 bg-zinc-800 rounded-full px-2.5 py-1">
                    Bekliyor
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Incoming requests (also shown in discover for easy access) */}
          {incoming.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Gelen istekler</p>
              {incoming.map((req) => (
                <div key={req.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5">
                  <Avatar name={req.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{req.name}</p>
                    {req.username && <p className="text-[10px] text-zinc-500">@{req.username}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => respond(req.id, "accept")}
                      disabled={respondingId === req.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                      Kabul
                    </button>
                    <button
                      onClick={() => respond(req.id, "reject")}
                      disabled={respondingId === req.id}
                      className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {incoming.length === 0 && outgoing.length === 0 && !searchQuery && (
            <div className="py-10 text-center">
              <p className="text-sm text-zinc-500">@kullanici_adi ile arama yap ve arkadas ekle</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
