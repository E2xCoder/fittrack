import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/social";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId = session.user.id;

  // All accepted friends
  const friendships = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ userId: myId }, { friendId: myId }] },
    select: { userId: true, friendId: true },
  });
  const friendIds = friendships.map((f) => (f.userId === myId ? f.friendId : f.userId));
  const allIds = [myId, ...friendIds];

  const weekStart = getWeekStart();

  const [users, logs] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: allIds } },
      select: { id: true, name: true, username: true },
    }),
    prisma.dailyLog.findMany({
      where: { userId: { in: allIds }, date: { gte: weekStart } },
      select: { userId: true, steps: true },
    }),
  ]);

  // Aggregate steps
  const stepsMap = new Map<string, number>();
  for (const log of logs) {
    stepsMap.set(log.userId, (stepsMap.get(log.userId) ?? 0) + (log.steps ?? 0));
  }

  const leaderboard = users
    .map((u) => ({
      userId:   u.id,
      name:     u.name ?? "User",
      username: u.username,
      steps:    stepsMap.get(u.id) ?? 0,
      isMe:     u.id === myId,
    }))
    .sort((a, b) => b.steps - a.steps);

  // Days remaining until Sunday (end of week)
  const todayDow      = new Date().getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysRemaining = todayDow === 0 ? 0 : 7 - todayDow;

  return NextResponse.json({ leaderboard, daysRemaining, weekStart: weekStart.toISOString() });
}
