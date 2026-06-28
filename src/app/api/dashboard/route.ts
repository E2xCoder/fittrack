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

  const [dailyLog, bodyLog, splits, latestWeightLog, latestMeasurementLog] = await Promise.all([
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
  ]);

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
  });
}
