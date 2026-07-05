import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      calorieTarget: true,
      proteinTarget: true,
      carbTarget: true,
      fatTarget: true,
      stepTarget: true,
      timezone: true,
    },
  });

  const userTz = userRow?.timezone ?? "Europe/Berlin";

  const date = dateParam
    ? new Date(`${dateParam}T12:00:00`)
    : getTodayInTimezone(userTz);

  if (dateParam) date.setHours(0, 0, 0, 0);

  // 7-day window for the weekly glance + streak (ending on the viewed date).
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const [dailyLog, bodyLog, splits, latestWeightLog, latestMeasurementLog, weekDailyLogs, weekBodyLogs, streakDailyLogs, streakBodyLogs] = await Promise.all([
    prisma.dailyLog.findFirst({
      where: { userId: session.user.id, date },
      include: {
        mealLogs: {
          include: { meal: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.bodyLog.findFirst({
      where: { userId: session.user.id, date },
    }),
    prisma.userSplit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bodyLog.findFirst({
      where: {
        userId: session.user.id,
        weight: { not: null },
      },
      orderBy: { date: "desc" },
      select: { date: true, weight: true },
    }),
    prisma.bodyLog.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { waist: { not: null } },
          { chest: { not: null } },
          { hip: { not: null } },
          { arm: { not: null } },
          { leg: { not: null } },
          { bodyFat: { not: null } },
        ],
      },
      orderBy: { date: "desc" },
      select: { date: true, waist: true, bodyFat: true },
    }),
    prisma.dailyLog.findMany({
      where: { userId: session.user.id, date: { gte: weekStart, lte: date } },
      select: { date: true, totalCalories: true, isGymDay: true },
    }),
    prisma.bodyLog.findMany({
      where: { userId: session.user.id, date: { gte: weekStart, lte: date } },
      select: { date: true, weight: true, steps: true },
    }),
    prisma.dailyLog.findMany({
      where: { userId: session.user.id },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
    prisma.bodyLog.findMany({
      where: { userId: session.user.id },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
  ]);

  // ── Weekly glance: one entry per day (meals / workout / weigh-in dots) ──
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: userTz });
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = dayKey(d);
    const dl = weekDailyLogs.find((l) => dayKey(new Date(l.date)) === key);
    const bl = weekBodyLogs.find((l) => dayKey(new Date(l.date)) === key);
    week.push({
      date: key,
      weekday: d.toLocaleDateString("en-GB", { weekday: "narrow", timeZone: userTz }),
      hasMeals: (dl?.totalCalories ?? 0) > 0,
      hasWorkout: dl?.isGymDay ?? false,
      hasWeighIn: bl?.weight != null,
    });
  }

  // ── Streak: consecutive logged days walking back from the viewed date ──
  const loggedDates = new Set<string>();
  for (const l of streakDailyLogs) loggedDates.add(dayKey(new Date(l.date)));
  for (const l of streakBodyLogs) loggedDates.add(dayKey(new Date(l.date)));

  const viewedKey = dayKey(date);
  let currentStreak = 0;
  const cursor = new Date(date);
  while (true) {
    const key = dayKey(cursor);
    if (loggedDates.has(key)) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (key === viewedKey) {
      // Don't break the streak just because the viewed day isn't logged yet.
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  const sortedDates = [...loggedDates].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const ds of sortedDates) {
    const d = new Date(ds);
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }

  return NextResponse.json({
    totalCalories: dailyLog?.totalCalories ?? 0,
    totalProtein: dailyLog?.totalProtein ?? 0,
    totalCarbs: dailyLog?.totalCarbs ?? 0,
    totalFat: dailyLog?.totalFat ?? 0,
    mealLogs: dailyLog?.mealLogs ?? [],
    goals: {
      calories: userRow?.calorieTarget ?? 2400,
      protein: userRow?.proteinTarget ?? 150,
      carbs: userRow?.carbTarget ?? 200,
      fat: userRow?.fatTarget ?? 70,
      steps: userRow?.stepTarget ?? 10000,
    },
    steps: bodyLog?.steps ?? 0,
    caloriesBurned: bodyLog?.caloriesBurned ?? 0,
    water: bodyLog?.water ?? 0,
    sleep: bodyLog?.sleep ?? 0,
    isGymDay: dailyLog?.isGymDay ?? false,
    gymSplit: dailyLog?.gymSplit ?? null,
    splits: splits ?? [],
    latestWeightLog,
    latestMeasurementLog,
    week,
    streak: { current: currentStreak, longest: longestStreak },
  });
}
