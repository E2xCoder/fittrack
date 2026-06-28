import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const periodDays = parseInt(req.nextUrl.searchParams.get("days") ?? "7");
  const clampedDays = [7, 30, 365].includes(periodDays) ? periodDays : 7;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calorieTarget: true,
      proteinTarget: true,
      carbTarget: true,
      fatTarget: true,
      weight: true,
      timezone: true,
    },
  });

  const goals = {
    calories: user?.calorieTarget ?? 2400,
    protein: user?.proteinTarget ?? 150,
    carbs: user?.carbTarget ?? 200,
    fat: user?.fatTarget ?? 70,
  };

  const userTz = user?.timezone ?? "Europe/Berlin";
  const today = getTodayInTimezone(userTz);
  const start = new Date(today);
  start.setDate(today.getDate() - (clampedDays - 1));
  start.setHours(0, 0, 0, 0);

  const [logs, bodyLogs] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { userId, date: { gte: start, lte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.bodyLog.findMany({
      where: { userId, date: { gte: start, lte: today } },
      orderBy: { date: "asc" },
    }),
  ]);

  const days = [];
  for (let i = 0; i < clampedDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: userTz });

    const log = logs.find(
      (l) => new Date(l.date).toLocaleDateString("en-CA", { timeZone: userTz }) === dateStr
    );
    const bodyLog = bodyLogs.find(
      (b) => new Date(b.date).toLocaleDateString("en-CA", { timeZone: userTz }) === dateStr
    );

    const calories = log?.totalCalories ?? 0;
    const protein = log?.totalProtein ?? 0;
    const carbs = log?.totalCarbs ?? 0;
    const fat = log?.totalFat ?? 0;
    const steps = bodyLog?.steps ?? 0;
    const caloriesBurned = bodyLog?.caloriesBurned ?? 0;
    const netCalories = calories - caloriesBurned;
    const deficit = goals.calories - netCalories;
    const proteinHit = protein >= goals.protein * 0.9;

    let label: string;
    if (clampedDays <= 7) {
      label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
    } else if (clampedDays <= 30) {
      label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } else {
      label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }

    days.push({
      date: dateStr,
      label,
      calories,
      protein,
      carbs,
      fat,
      steps,
      caloriesBurned,
      netCalories,
      deficit,
      proteinHit,
      logged: !!log || !!bodyLog,
      isGymDay: log?.isGymDay ?? false,
      gymSplit: log?.gymSplit ?? null,
    });
  }

  const loggedDays = days.filter((d) => d.logged);
  const loggedCount = loggedDays.length;

  const avgCalories = loggedCount ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedCount) : 0;
  const avgProtein = loggedCount ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedCount) : 0;
  const avgCarbs = loggedCount ? Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedCount) : 0;
  const avgFat = loggedCount ? Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedCount) : 0;

  const deficitDays = days.filter((d) => d.logged && d.deficit > 0).length;
  const surplusDays = days.filter((d) => d.logged && d.deficit < 0).length;
  const proteinHitDays = days.filter((d) => d.logged && d.proteinHit).length;
  const gymDays = days.filter((d) => d.isGymDay).length;

  const stepsLogged = days.filter((d) => d.steps > 0);
  const avgSteps = stepsLogged.length
    ? Math.round(stepsLogged.reduce((s, d) => s + d.steps, 0) / stepsLogged.length)
    : 0;

  // Achievement rates (0-100)
  const calorieAchievementRate = loggedCount ? Math.round((deficitDays / loggedCount) * 100) : 0;
  const proteinAchievementRate = loggedCount ? Math.round((proteinHitDays / loggedCount) * 100) : 0;
  const loggingRate = Math.round((loggedCount / clampedDays) * 100);
  const gymFrequency = clampedDays >= 7 ? Math.round((gymDays / (clampedDays / 7)) * 10) / 10 : gymDays;

  // ── Streak calculation (uses full history, independent of period) ──
  const allLogs = await prisma.dailyLog.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  const allBodyLogs = await prisma.bodyLog.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  // Collect all distinct logged dates
  const loggedDateSet = new Set<string>();
  for (const l of allLogs)
    loggedDateSet.add(new Date(l.date).toLocaleDateString("en-CA", { timeZone: userTz }));
  for (const b of allBodyLogs)
    loggedDateSet.add(new Date(b.date).toLocaleDateString("en-CA", { timeZone: userTz }));

  const todayStr = today.toLocaleDateString("en-CA", { timeZone: userTz });

  // Current streak — walk back from today
  let currentStreak = 0;
  {
    const cur = new Date(today);
    while (true) {
      const ds = cur.toLocaleDateString("en-CA", { timeZone: userTz });
      if (loggedDateSet.has(ds)) {
        currentStreak++;
        cur.setDate(cur.getDate() - 1);
      } else {
        // Allow today to be unlogged (don't break streak if today hasn't been logged yet)
        if (ds === todayStr) {
          cur.setDate(cur.getDate() - 1);
          continue;
        }
        break;
      }
    }
  }

  // Longest streak — iterate sorted dates
  const sortedDates = [...loggedDateSet].sort();
  let longestStreak = 0;
  let runStreak = 0;
  let prevDate: Date | null = null;
  for (const ds of sortedDates) {
    const d = new Date(ds);
    if (prevDate) {
      const diff = Math.round((d.getTime() - prevDate.getTime()) / 86400000);
      if (diff === 1) {
        runStreak++;
      } else {
        longestStreak = Math.max(longestStreak, runStreak);
        runStreak = 1;
      }
    } else {
      runStreak = 1;
    }
    prevDate = d;
  }
  longestStreak = Math.max(longestStreak, runStreak);

  // Verdicts
  const verdicts: string[] = [];
  if (loggedCount === 0) {
    verdicts.push("📭 No data logged this period. Start tracking to see insights.");
  } else {
    if (deficitDays >= loggedCount * 0.7) verdicts.push(`✅ Great calorie discipline — deficit ${deficitDays}/${loggedCount} logged days.`);
    else if (surplusDays >= loggedCount * 0.7) verdicts.push(`⚠️ Heavy surplus period — ${surplusDays} days over target.`);
    else verdicts.push(`〰️ Mixed calorie period — ${deficitDays} deficit vs ${surplusDays} surplus days.`);

    if (proteinHitDays === loggedCount) verdicts.push("🔥 Perfect protein consistency — hit target every logged day!");
    else if (proteinHitDays >= loggedCount * 0.8) verdicts.push(`✅ Protein on point — hit target ${proteinHitDays}/${loggedCount} days.`);
    else if (proteinHitDays < loggedCount * 0.4) verdicts.push(`❌ Protein needs work — only ${proteinHitDays}/${loggedCount} days hit ${goals.protein}g.`);
    else verdicts.push(`⚠️ Protein hit ${proteinHitDays}/${loggedCount} days — aim higher.`);

    if (gymDays >= clampedDays / 7 * 5) verdicts.push(`💪 Beast mode — ${gymDays} gym sessions!`);
    else if (gymDays >= clampedDays / 7 * 3) verdicts.push(`✅ Good gym frequency — ${gymDays} sessions.`);
    else verdicts.push(`〰️ ${gymDays} gym sessions — try for more consistency.`);

    if (avgCalories > 0 && avgCalories < goals.calories - 700)
      verdicts.push(`⚠️ Average calories very low (${avgCalories} kcal) — risk of muscle loss.`);
    else if (avgCalories > goals.calories + 500)
      verdicts.push(`⚠️ Average calories high (${avgCalories} kcal) — ${avgCalories - goals.calories} over target.`);

    if (avgSteps >= 10000) verdicts.push(`🚶 Amazing — averaging ${avgSteps.toLocaleString()} steps/day!`);
    else if (avgSteps >= 7500) verdicts.push(`🚶 Good steps — ${avgSteps.toLocaleString()}/day.`);
    else if (avgSteps > 0) verdicts.push(`〰️ Steps averaging ${avgSteps.toLocaleString()}/day — aim for 7,500+.`);

    if (deficitDays >= loggedCount * 0.6 && proteinHitDays >= loggedCount * 0.6 && gymDays >= clampedDays / 7 * 3)
      verdicts.push("🏆 Excellent period overall — great balance of diet and training!");

    if (loggedCount === clampedDays) verdicts.push(`📊 Perfect logging — all ${clampedDays} days tracked!`);
    else if (loggedCount >= clampedDays * 0.8) verdicts.push(`📊 ${loggedCount}/${clampedDays} days logged — good consistency.`);
    else verdicts.push(`📊 Only ${loggedCount}/${clampedDays} days logged — try to track every day.`);
  }

  return NextResponse.json({
    goals,
    days,
    period: clampedDays,
    summary: {
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      avgSteps,
      deficitDays,
      surplusDays,
      proteinHitDays,
      gymDays,
      loggedDays: loggedCount,
      calorieAchievementRate,
      proteinAchievementRate,
      loggingRate,
      gymFrequency,
      currentStreak,
      longestStreak,
    },
    verdicts,
  });
}
