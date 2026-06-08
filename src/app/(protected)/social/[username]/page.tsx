"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PublicProfile {
  id:                string;
  name:              string | null;
  username:          string | null;
  streak:            number | null;
  weeklyStepsAvg:    number | null;
  weeklyCaloriesAvg: number | null;
  isGymDay:          boolean | null;
  gymSplit:          string | null;
}

const AVATAR_COLORS = [
  "bg-red-600","bg-orange-600","bg-yellow-600","bg-green-600",
  "bg-teal-600","bg-blue-600","bg-indigo-600","bg-pink-600",
];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function PublicProfilePage() {
  const params  = useParams();
  const username = typeof params.username === "string" ? params.username : "";

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reqSent, setReqSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!username) return;
    fetch(`/api/social/profile/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        setProfile(await res.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  async function addFriend() {
    if (!profile) return;
    setSending(true);
    try {
      await fetch("/api/social/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      setReqSent(true);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-zinc-800" />
              <div className="h-3 w-20 rounded bg-zinc-800" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto max-w-lg p-4 text-center py-20">
        <p className="text-3xl mb-3">404</p>
        <p className="text-zinc-400 mb-4">Bu profil bulunamadi veya gizli.</p>
        <Link href="/social" className="text-sm text-green-400 hover:text-green-300">
          ← Sosyal sayfaya don
        </Link>
      </main>
    );
  }

  const displayName = profile.name ?? profile.username ?? "Kullanici";
  const initial     = displayName[0]?.toUpperCase() ?? "?";

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-4">
        <Link href="/social" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Social
        </Link>
      </div>

      {/* Profile header */}
      <div className="mb-5 flex items-center gap-4">
        <div className={`h-14 w-14 ${avatarColor(displayName)} flex items-center justify-center rounded-full text-xl font-bold text-white`}>
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-black text-white">{displayName}</h1>
          {profile.username && <p className="text-sm text-zinc-400">@{profile.username}</p>}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {profile.streak !== null && (
          <div className="rounded-xl border border-orange-800/40 bg-orange-950/20 p-3 text-center">
            <p className="text-2xl font-black text-orange-400">{profile.streak}</p>
            <p className="text-[11px] text-zinc-400">Gun streak</p>
          </div>
        )}
        {profile.weeklyStepsAvg !== null && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
            <p className="text-2xl font-black text-white">{profile.weeklyStepsAvg.toLocaleString()}</p>
            <p className="text-[11px] text-zinc-400">Adim/gun (bu hafta)</p>
          </div>
        )}
        {profile.weeklyCaloriesAvg !== null && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
            <p className="text-2xl font-black text-white">{profile.weeklyCaloriesAvg}</p>
            <p className="text-[11px] text-zinc-400">kcal/gun (bu hafta)</p>
          </div>
        )}
        {profile.isGymDay !== null && (
          <div className={`rounded-xl border p-3 text-center ${
            profile.isGymDay ? "border-green-800/40 bg-green-950/20" : "border-zinc-800 bg-zinc-900"
          }`}>
            <p className={`text-sm font-black ${profile.isGymDay ? "text-green-400" : "text-zinc-500"}`}>
              {profile.isGymDay ? (profile.gymSplit ?? "Gym") : "Rest Day"}
            </p>
            <p className="text-[11px] text-zinc-400">Bugun</p>
          </div>
        )}
      </div>

      {/* Add friend button */}
      {reqSent ? (
        <div className="rounded-xl bg-zinc-800 py-3 text-center text-sm text-zinc-400">
          Arkadaslik istegi gonderildi
        </div>
      ) : (
        <button
          onClick={addFriend}
          disabled={sending}
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
        >
          {sending ? "Gonderiliyor..." : "Arkadas Ekle"}
        </button>
      )}
    </main>
  );
}
