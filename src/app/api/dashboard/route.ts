import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const date = dateParam ? new Date(dateParam) : new Date();
  date.setHours(0, 0, 0, 0);

  const [dailyLog, user] = await Promise.all([
    prisma.dailyLog.findFirst({
      where: { userId: session.user.id, date },
      include: {
        mealLogs: {
          include: { meal: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        calorieTarget: true,
        proteinTarget: true,
        carbTarget: true,
        fatTarget: true,
      },
    }),
  ]);

  return NextResponse.json({
    totalCalories: dailyLog?.totalCalories ?? 0,
    totalProtein: dailyLog?.totalProtein ?? 0,
    totalCarbs: dailyLog?.totalCarbs ?? 0,
    totalFat: dailyLog?.totalFat ?? 0,
    mealLogs: dailyLog?.mealLogs ?? [],
    goals: {
      calories: user?.calorieTarget ?? 2400,
      protein: user?.proteinTarget ?? 150,
      carbs: user?.carbTarget ?? 200,
      fat: user?.fatTarget ?? 70,
    },
  });
}