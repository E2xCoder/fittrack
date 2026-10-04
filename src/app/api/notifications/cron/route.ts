import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/webpush";
import { getTodayInTimezone } from "@/lib/date";

// Vercel Cron fires every hour: "0 * * * *"
// This handler notifies users where their local time is 08:xx

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Returns true if the current UTC instant is 08:xx in the given timezone. */
function isUserMorning(timezone: string): boolean {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    return parseInt(hourStr, 10) === 8;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // Verify request comes from Vercel Cron (or our own server)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all push subscriptions with user timezone
  const allSubs = await prisma.pushSubscription.findMany({
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      user: { select: { id: true, timezone: true } },
    },
  });

  if (allSubs.length === 0) {
    return NextResponse.json({ message: "No subscribers", sent: 0 });
  }

  // Filter to users where local time is currently 08:xx
  const morningSubs = allSubs.filter((sub) =>
    isUserMorning(sub.user?.timezone ?? "Europe/Berlin")
  );

  if (morningSubs.length === 0) {
    return NextResponse.json({ message: "No users in morning window", sent: 0 });
  }

  const staleIds: string[] = [];
  let sent = 0;

  // Process each user individually so we use their local "today"
  for (const sub of morningSubs) {
    const userTz = sub.user?.timezone ?? "Europe/Berlin";
    const today = getTodayInTimezone(userTz);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const [mealLog, recentWorkout] = await Promise.all([
      prisma.dailyLog.findFirst({
        where: { userId: sub.userId, date: today, totalCalories: { gt: 0 } },
        select: { id: true },
      }),
      prisma.workout.findFirst({
        where: { userId: sub.userId, date: { gte: threeDaysAgo } },
        select: { id: true },
      }),
    ]);

    const notifications: Array<{ title: string; body: string; url: string; tag: string }> = [];

    if (!mealLog) {
      notifications.push({
        title: "🍽️ Don't forget to log your meals!",
        body: "You haven't logged any food today. Add a meal to keep your streak going.",
        url: "/meals",
        tag: "fittrack-meal-reminder",
      });
    }

    if (!recentWorkout) {
      notifications.push({
        title: "💪 Time to train!",
        body: "No workout logged for 3 days. How about a session today?",
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
    morningUsers: morningSubs.length,
    staleRemoved: staleIds.length,
  });
}
