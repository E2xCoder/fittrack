import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcStreak, getWeekStart } from "@/lib/social";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId = session.user.id;

  const [friendships, incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: "accepted",
        OR: [{ userId: myId }, { friendId: myId }],
      },
      include: {
        user:   { select: { id: true, name: true, username: true, shareSteps: true, shareCalories: true, shareWorkout: true, shareStreak: true } },
        friend: { select: { id: true, name: true, username: true, shareSteps: true, shareCalories: true, shareWorkout: true, shareStreak: true } },
      },
    }),
    prisma.friendship.findMany({
      where: { friendId: myId, status: "pending" },
      include: { user: { select: { id: true, name: true, username: true } } },
    }),
    prisma.friendship.findMany({
      where: { userId: myId, status: "pending" },
      include: { friend: { select: { id: true, name: true, username: true } } },
    }),
  ]);

  const weekStart = getWeekStart();
  const todayUTC  = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);

  const friends = await Promise.all(
    friendships.map(async (f) => {
      const person = f.userId === myId ? f.friend : f.user;

      const [weekLogs, { streak, loggedToday, lastLogDate }] = await Promise.all([
        prisma.dailyLog.findMany({
          where: { userId: person.id, date: { gte: weekStart } },
          orderBy: { date: "desc" },
          select: { date: true, totalCalories: true, steps: true, isGymDay: true, gymSplit: true },
        }),
        calcStreak(person.id),
      ]);

      // Today's log
      const todayLog = weekLogs.find((l) => {
        const d = new Date(l.date); d.setUTCHours(0, 0, 0, 0);
        return d.getTime() === todayUTC.getTime();
      });

      // Weekly averages (only days with any data)
      const active = weekLogs.filter((l) => l.totalCalories > 0 || (l.steps ?? 0) > 0);
      const days   = active.length || 1;
      const weeklyStepsAvg    = Math.round(active.reduce((s, l) => s + (l.steps ?? 0),          0) / days);
      const weeklyCaloriesAvg = Math.round(active.reduce((s, l) => s + (l.totalCalories ?? 0), 0) / days);

      return {
        friendshipId: f.id,
        userId:       person.id,
        name:         person.name ?? "User",
        username:     person.username,
        streak:           person.shareStreak   ? streak           : null,
        weeklyStepsAvg:   person.shareSteps    ? weeklyStepsAvg   : null,
        weeklyCaloriesAvg: person.shareCalories ? weeklyCaloriesAvg : null,
        isGymDay:  person.shareWorkout ? (todayLog?.isGymDay ?? false) : null,
        gymSplit:  person.shareWorkout ? (todayLog?.gymSplit  ?? null)  : null,
        lastLogDate:    lastLogDate?.toISOString() ?? null,
        isStreakDanger: streak > 0 && !loggedToday,
      };
    })
  );

  return NextResponse.json({
    friends,
    incoming: incoming.map((f) => ({
      id: f.id, userId: f.userId,
      name: f.user.name ?? "User", username: f.user.username,
      createdAt: f.createdAt.toISOString(),
    })),
    outgoing: outgoing.map((f) => ({
      id: f.id, friendId: f.friendId,
      name: f.friend.name ?? "User", username: f.friend.username,
      status: f.status,
    })),
  });
}
