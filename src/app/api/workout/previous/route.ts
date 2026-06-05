import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const exerciseName = searchParams.get("exerciseName") ?? "";
  if (!exerciseName) return NextResponse.json({ lastWeekBest: null, thisWeekBest: null });

  const today = getTodayInTimezone();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  const [lastWeekExs, thisWeekExs] = await Promise.all([
    prisma.exercise.findMany({
      where: {
        userId: session.user.id,
        name: exerciseName,
        workout: { date: { gte: sixtyDaysAgo, lt: oneWeekAgo } },
      },
      include: { sets: true },
    }),
    prisma.exercise.findMany({
      where: {
        userId: session.user.id,
        name: exerciseName,
        workout: { date: { gte: oneWeekAgo, lt: today } },
      },
      include: { sets: true },
    }),
  ]);

  function bestSet(exs: typeof lastWeekExs) {
    let best: { weight: number; reps: number; volume: number } | null = null;
    for (const ex of exs) {
      for (const s of ex.sets) {
        if (s.weight && s.reps) {
          const volume = s.weight * s.reps;
          if (!best || volume > best.volume) {
            best = { weight: s.weight, reps: s.reps, volume };
          }
        }
      }
    }
    return best;
  }

  return NextResponse.json({
    lastWeekBest: bestSet(lastWeekExs),
    thisWeekBest: bestSet(thisWeekExs),
  });
}
