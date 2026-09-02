import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [profile, workouts, dailyLogs, mealLogs, bodyLogs, weightLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        height: true,
        weight: true,
        calorieTarget: true,
        proteinTarget: true,
        carbTarget: true,
        fatTarget: true,
        stepTarget: true,
        waterTarget: true,
        sleepTarget: true,
        age: true,
        gender: true,
        activityLevel: true,
        goal: true,
        dietaryPreferences: true,
        createdAt: true,
      },
    }),
    prisma.workout.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      include: {
        exercises: {
          orderBy: { orderIndex: "asc" },
          include: { sets: { orderBy: { setNumber: "asc" } } },
        },
      },
    }),
    prisma.dailyLog.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    prisma.mealLog.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        mealSnapshot: true,
        dailyLogId: true,
      },
    }),
    prisma.bodyLog.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    prisma.weightLog.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    gdprNote: "This export contains all personal data held by FitTrack under GDPR Art. 20.",
    profile,
    workouts,
    dailyLogs,
    mealLogs,
    bodyLogs,
    weightLogs,
  };

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fittrack-export-${date}.json"`,
    },
  });
}
