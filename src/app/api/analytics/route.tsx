import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calorieTarget: true,
      proteinTarget: true,
      carbTarget: true,
      fatTarget: true,
      weight: true,
    },
  });

  const goals = {
    calories: user?.calorieTarget ?? 2400,
    protein: user?.proteinTarget ?? 150,
    carbs: user?.carbTarget ?? 200,
    fat: user?.fatTarget ?? 70,
  };

  const today = getTodayInTimezone();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const [logs, bodyLogs] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { userId, date: { gte: sevenDaysAgo, lte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.bodyLog.findMany({
      where: { userId, date: { gte: sevenDaysAgo, lte: today } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Build daily breakdown
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });

    const log = logs.find((l) =>
      new Date(l.date).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }) === dateStr
    );

    const bodyLog = bodyLogs.find((b) =>
      new Date(b.date).toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }) === dateStr
    );

    const calories = log?.totalCalories ?? 0;
    const protein = log?.totalProtein ?? 0;
    const carbs = log?.totalCarbs ?? 0;
    const fat = log?.totalFat ?? 0;
    const steps = bodyLog?.steps ?? 0;
    const caloriesBurned = bodyLog?.caloriesBurned ?? 0;

    // Net calories = eaten - burned from steps
    const netCalories = calories - caloriesBurned;
    const deficit = goals.calories - netCalories;
    const proteinHit = protein >= goals.protein * 0.9;

    days.push({
      date: dateStr,
      label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
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

  const avgCalories = loggedCount
    ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedCount) : 0;
  const avgProtein = loggedCount
    ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedCount) : 0;
  const avgCarbs = loggedCount
    ? Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedCount) : 0;
  const avgFat = loggedCount
    ? Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedCount) : 0;

  const deficitDays = days.filter((d) => d.logged && d.deficit > 0).length;
  const surplusDays = days.filter((d) => d.logged && d.deficit < 0).length;
  const proteinHitDays = days.filter((d) => d.logged && d.proteinHit).length;
  const gymDays = days.filter((d) => d.isGymDay).length;

  const verdicts: string[] = [];
  if (loggedCount === 0) {
    verdicts.push("No data logged this week.");
  } else {
    if (deficitDays >= 4) verdicts.push("✅ Good calorie deficit this week.");
    else if (surplusDays >= 4) verdicts.push("⚠️ You were in surplus most days.");
    else verdicts.push("〰️ Mixed calorie week — aim for more consistency.");

    if (proteinHitDays >= 5) verdicts.push("✅ Protein target hit consistently.");
    else if (proteinHitDays >= 3) verdicts.push("⚠️ Protein hit " + proteinHitDays + "/" + loggedCount + " days.");
    else verdicts.push("❌ Low protein this week. Aim for " + goals.protein + "g daily.");

    if (gymDays >= 4) verdicts.push("✅ Great gym consistency — " + gymDays + " sessions.");
    else if (gymDays >= 2) verdicts.push("〰️ " + gymDays + " gym sessions. Try for 4+.");
    else verdicts.push("❌ Only " + gymDays + " gym session(s) this week.");

    if (avgCalories > 0 && avgCalories < goals.calories - 500)
      verdicts.push("⚠️ Average calories very low — make sure you're eating enough.");
  }

  return NextResponse.json({
    goals,
    days,
    summary: {
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      deficitDays,
      surplusDays,
      proteinHitDays,
      gymDays,
      loggedDays: loggedCount,
    },
    verdicts,
  });
}