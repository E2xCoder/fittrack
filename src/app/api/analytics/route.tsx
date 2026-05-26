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

  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [logs, bodyLogs] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { userId, date: { gte: monday, lte: sunday } },
      orderBy: { date: "asc" },
    }),
    prisma.bodyLog.findMany({
      where: { userId, date: { gte: monday, lte: sunday } },
      orderBy: { date: "asc" },
    }),
  ]);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
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

  const avgSteps = days.filter(d => d.steps > 0).length > 0
    ? Math.round(days.filter(d => d.steps > 0).reduce((s, d) => s + d.steps, 0) / days.filter(d => d.steps > 0).length)
    : 0;

  const verdicts: string[] = [];

  if (loggedCount === 0) {
    verdicts.push("📭 No data logged this week. Start tracking to see insights.");
  } else {
    // Kalori
    if (deficitDays >= 5) verdicts.push("✅ Excellent calorie discipline — deficit " + deficitDays + "/7 days.");
    else if (deficitDays >= 4) verdicts.push("✅ Good calorie deficit this week — " + deficitDays + " days.");
    else if (surplusDays >= 5) verdicts.push("⚠️ Heavy surplus week — " + surplusDays + " days over target.");
    else if (surplusDays >= 3) verdicts.push("⚠️ More surplus than deficit days this week.");
    else verdicts.push("〰️ Mixed calorie week — aim for more consistency.");

    // Protein
    if (proteinHitDays === loggedCount) verdicts.push("🔥 Perfect protein week — hit target every logged day!");
    else if (proteinHitDays >= 5) verdicts.push("✅ Protein target hit consistently — " + proteinHitDays + " days.");
    else if (proteinHitDays >= 3) verdicts.push("⚠️ Protein hit " + proteinHitDays + "/" + loggedCount + " days — push harder.");
    else if (proteinHitDays === 0) verdicts.push("❌ Protein target missed all week. Aim for " + goals.protein + "g daily.");
    else verdicts.push("❌ Low protein this week — only " + proteinHitDays + " days hit. Aim for " + goals.protein + "g.");

    // Gym
    if (gymDays >= 5) verdicts.push("💪 Beast mode — " + gymDays + " gym sessions this week!");
    else if (gymDays >= 4) verdicts.push("✅ Great gym consistency — " + gymDays + " sessions.");
    else if (gymDays === 3) verdicts.push("〰️ 3 gym sessions — solid but room to improve.");
    else if (gymDays >= 2) verdicts.push("〰️ " + gymDays + " gym sessions. Try for 4+.");
    else if (gymDays === 1) verdicts.push("❌ Only 1 gym session this week — get back on track.");
    else verdicts.push("❌ No gym sessions logged this week.");

    // Kalori seviyesi
    if (avgCalories > 0 && avgCalories < goals.calories - 700)
      verdicts.push("⚠️ Average calories very low (" + avgCalories + " kcal) — risk of muscle loss.");
    else if (avgCalories > goals.calories + 500)
      verdicts.push("⚠️ Average calories high (" + avgCalories + " kcal) — " + (avgCalories - goals.calories) + " over target.");

    // Adım
    if (avgSteps >= 10000) verdicts.push("🚶 Amazing step count — averaging " + avgSteps.toLocaleString() + " steps/day!");
    else if (avgSteps >= 7500) verdicts.push("🚶 Good step count — averaging " + avgSteps.toLocaleString() + " steps/day.");
    else if (avgSteps >= 5000) verdicts.push("〰️ Average steps " + avgSteps.toLocaleString() + "/day — try to hit 7,500+.");
    else if (avgSteps > 0) verdicts.push("⚠️ Low step count this week — averaging only " + avgSteps.toLocaleString() + "/day.");

    // Kombinasyon
    if (deficitDays >= 4 && proteinHitDays >= 4 && gymDays >= 3)
      verdicts.push("🏆 Excellent week overall — great balance of diet and training!");
    else if (deficitDays >= 4 && gymDays === 0)
      verdicts.push("💡 Good diet but no gym — combine with training for best results.");
    else if (gymDays >= 4 && proteinHitDays < 3)
      verdicts.push("💡 Training hard but protein is low — recovery will suffer.");

    // Logging streak
    if (loggedCount === 7) verdicts.push("📊 Perfect logging week — all 7 days tracked!");
    else if (loggedCount >= 5) verdicts.push("📊 " + loggedCount + "/7 days logged — good consistency.");
    else verdicts.push("📊 Only " + loggedCount + "/7 days logged — try to track every day.");
  }

  const weekLabel = `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  return NextResponse.json({
    goals,
    days,
    weekLabel,
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
    },
    verdicts,
  });
}