import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/webpush";
import { getTodayInTimezone } from "@/lib/date";

// Vercel Cron fires at 18:00 UTC = 20:00 Berlin CEST (summer).
// In CET (winter) this lands at 19:00 Berlin, which is acceptable.
// Schedule declared in vercel.json: "0 18 * * *"

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Verify request comes from Vercel Cron (or our own server)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayInTimezone();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find all users who have at least one push subscription
  const usersWithSubs = await prisma.pushSubscription.findMany({
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      user: { select: { id: true } },
    },
  });

  if (usersWithSubs.length === 0) {
    return NextResponse.json({ message: "No subscribers", sent: 0 });
  }

  const uniqueUserIds: string[] = [...new Set<string>(usersWithSubs.map((s) => s.userId))];

  // Check meal logs for today
  const mealLogsToday = await prisma.dailyLog.findMany({
    where: {
      userId: { in: uniqueUserIds },
      date: today,
      totalCalories: { gt: 0 },
    },
    select: { userId: true },
  });
  const usersLoggedMeals = new Set<string>(mealLogsToday.map((l) => l.userId));

  // Check workout logs for last 3 days
  const recentWorkouts = await prisma.workout.findMany({
    where: {
      userId: { in: uniqueUserIds },
      date: { gte: threeDaysAgo },
    },
    select: { userId: true },
  });
  const usersLoggedWorkout = new Set<string>(recentWorkouts.map((w) => w.userId));

  const staleIds: string[] = [];
  let sent = 0;

  for (const sub of usersWithSubs) {
    const notifications: Array<{ title: string; body: string; url: string; tag: string }> = [];

    if (!usersLoggedMeals.has(sub.userId)) {
      notifications.push({
        title: "🍽️ Öğün takibini unuttun!",
        body: "Bugün henüz yemek logleemedin. Günlük takibini korumak için bir öğün ekle.",
        url: "/meals",
        tag: "fittrack-meal-reminder",
      });
    }

    if (!usersLoggedWorkout.has(sub.userId)) {
      notifications.push({
        title: "💪 Antrenman zamanı!",
        body: "3 gündür antrenman logu yok. Bugün bir seans yapmak ister misin?",
        url: "/workout",
        tag: "fittrack-workout-reminder",
      });
    }

    for (const payload of notifications) {
      const result = await sendPushNotification(sub, payload);
      if (result.ok) {
        sent++;
      } else if (result.gone) {
        staleIds.push(sub.id);
      }
    }
  }

  // Clean up expired subscriptions
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }

  return NextResponse.json({
    sent,
    subscribers: usersWithSubs.length,
    staleRemoved: staleIds.length,
  });
}
