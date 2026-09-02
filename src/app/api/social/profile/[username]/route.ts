import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcStreak, getWeekStart } from "@/lib/social";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, name: true, username: true,
      isPublic: true, shareSteps: true, shareCalories: true,
      shareWorkout: true, shareStreak: true,
    },
  });

  if (!user || !user.isPublic) {
    return NextResponse.json({ error: "Profile not found or private" }, { status: 404 });
  }

  const weekStart = getWeekStart();
  const [{ streak }, weekLogs, todayLog] = await Promise.all([
    calcStreak(user.id),
    prisma.dailyLog.findMany({
      where: { userId: user.id, date: { gte: weekStart } },
      select: { date: true, steps: true, totalCalories: true },
    }),
    prisma.dailyLog.findFirst({
      where: {
        userId: user.id,
        date: (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d; })(),
      },
      select: { isGymDay: true, gymSplit: true },
    }),
  ]);

  const activeDays = weekLogs.filter((l) => l.totalCalories > 0 || (l.steps ?? 0) > 0);
  const days = activeDays.length || 1;
  const weeklyStepsAvg    = Math.round(activeDays.reduce((s, l) => s + (l.steps ?? 0), 0) / days);
  const weeklyCaloriesAvg = Math.round(activeDays.reduce((s, l) => s + (l.totalCalories ?? 0), 0) / days);

  return NextResponse.json({
    id:       user.id,
    name:     user.name,
    username: user.username,
    streak:   user.shareStreak   ? streak           : null,
    weeklyStepsAvg:    user.shareSteps    ? weeklyStepsAvg   : null,
    weeklyCaloriesAvg: user.shareCalories ? weeklyCaloriesAvg : null,
    isGymDay:  user.shareWorkout ? (todayLog?.isGymDay ?? false) : null,
    gymSplit:  user.shareWorkout ? (todayLog?.gymSplit  ?? null)  : null,
  });
}
