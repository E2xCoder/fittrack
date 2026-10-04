import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";
import { currentStreak as computeCurrentStreak, longestStreak as computeLongestStreak, pctChange } from "@/lib/fitness";

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
    const water = bodyLog?.water ?? 0;
    const sleep = bodyLog?.sleep ?? 0;
    const weight = bodyLog?.weight ?? null;
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
      water,
      sleep,
      weight,
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
  const currentStreak = computeCurrentStreak(loggedDateSet, todayStr);
  const longestStreak = computeLongestStreak(loggedDateSet);

  // ── Week-over-week: trailing 7 days vs the 7 before, independent of period ──
  const wowStart = new Date(today);
  wowStart.setDate(today.getDate() - 13);
  wowStart.setHours(0, 0, 0, 0);

  const [wowDaily, wowBody] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { userId, date: { gte: wowStart, lte: today } },
      select: { date: true, totalCalories: true, totalProtein: true },
    }),
    prisma.bodyLog.findMany({
      where: { userId, date: { gte: wowStart, lte: today } },
      select: { date: true, steps: true },
    }),
  ]);

  function avgOver(startOffset: number, endOffset: number) {
    // offsets are days-ago (inclusive start, exclusive-ish end)
    const s = new Date(today);
    s.setDate(today.getDate() - startOffset);
    const e = new Date(today);
    e.setDate(today.getDate() - endOffset);
    const inRange = (d: Date) => d >= s && d <= e;
    const cals = wowDaily.filter((l) => inRange(new Date(l.date)) && l.totalCalories > 0);
    const prot = wowDaily.filter((l) => inRange(new Date(l.date)) && l.totalProtein > 0);
    const stp = wowBody.filter((l) => inRange(new Date(l.date)) && (l.steps ?? 0) > 0);
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      calories: Math.round(mean(cals.map((l) => l.totalCalories))),
      protein: Math.round(mean(prot.map((l) => l.totalProtein))),
      steps: Math.round(mean(stp.map((l) => l.steps ?? 0))),
    };
  }

  const thisWeek = avgOver(6, 0);
  const lastWeek = avgOver(13, 7);

  const wow = {
    calories: pctChange(thisWeek.calories, lastWeek.calories),
    protein: pctChange(thisWeek.protein, lastWeek.protein),
    steps: pctChange(thisWeek.steps, lastWeek.steps),
  };

  const consistencyScore = loggingRate; // % of period days with any log

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
      consistencyScore,
    },
    wow,
    verdicts,
  });
}
