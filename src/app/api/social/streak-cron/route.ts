import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/webpush";
import { calcStreak } from "@/lib/social";

// Vercel Cron fires at 17:00 UTC = 19:00 Turkey time (UTC+2, CEST)
// Schedule declared in vercel.json: "0 17 * * *"

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All accepted friendships
  const friendships = await prisma.friendship.findMany({
    where: { status: "accepted" },
    select: { userId: true, friendId: true },
  });

  // All user IDs involved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allUserIds: string[] = [...new Set((friendships as any[]).flatMap((f) => [f.userId as string, f.friendId as string]))];

  // Get streaks for all users
  const streakMap = new Map<string, { streak: number; loggedToday: boolean }>();
  await Promise.all(
    allUserIds.map(async (id) => {
      const result = await calcStreak(id);
      streakMap.set(id, result);
    })
  );

  // Build a map: userId → friendIds they should be notified about
  const notifyMap = new Map<string, { friendId: string; name: string; streak: number }[]>();
  for (const f of friendships) {
    const dangerousFriend = (friendId: string, notifyUserId: string) => {
      const data = streakMap.get(friendId);
      if (!data || data.streak === 0 || data.loggedToday) return;
      const existing = notifyMap.get(notifyUserId) ?? [];
      existing.push({ friendId, name: "", streak: data.streak });
      notifyMap.set(notifyUserId, existing);
    };
    dangerousFriend(f.friendId, f.userId);
    dangerousFriend(f.userId,   f.friendId);
  }

  if (notifyMap.size === 0) return NextResponse.json({ sent: 0, message: "No streak danger" });

  // Fetch friend names
  const friendIdsToFetch = [...new Set(
    [...notifyMap.values()].flatMap((arr) => arr.map((a) => a.friendId))
  )];
  const names = await prisma.user.findMany({
    where: { id: { in: friendIdsToFetch } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(names.map((u) => [u.id, u.name ?? "Arkadas"]));

  // Fetch subscriptions for users who need to be notified
  const notifyUserIds = [...notifyMap.keys()];
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: notifyUserIds } },
  });

  const staleIds: string[] = [];
  let sent = 0;

  for (const sub of subs) {
    const dangers = notifyMap.get(sub.userId) ?? [];
    for (const danger of dangers) {
      const friendName = nameMap.get(danger.friendId) ?? "Arkadas";
      const result = await sendPushNotification(sub, {
        title: "Streak tehlikede!",
        body:  `${friendName}'in ${danger.streak} gunluk streaki tehlikede!`,
        url:   "/social",
        tag:   `streak-danger-${danger.friendId}`,
      });
      if (result.ok) {
        sent++;
      } else if (result.gone) {
        staleIds.push(sub.id);
      }
    }
  }

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }

  return NextResponse.json({ sent, staleRemoved: staleIds.length });
}
