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
  if (!exerciseName) {
    return NextResponse.json({ lastBestSet: null, prevBestSet: null, suggestion: null, isPR: false });
  }

  const userTzRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const today = getTodayInTimezone(userTzRow?.timezone ?? "Europe/Berlin");
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  // Fetch every occurrence of this exercise in the last 60 days, newest first
  const occurrences = await prisma.exercise.findMany({
    where: {
      userId: session.user.id,
      name: exerciseName,
      workout: { date: { gte: sixtyDaysAgo } },
    },
    include: {
      sets: true,
      workout: { select: { id: true, date: true } },
    },
    orderBy: { workout: { date: "desc" } },
  });

  // Group sets by workout, preserving newest-first order
  const workoutMap = new Map<string, { date: Date; sets: (typeof occurrences)[0]["sets"] }>();
  for (const ex of occurrences) {
    const wid = ex.workout.id;
    if (!workoutMap.has(wid)) {
      workoutMap.set(wid, { date: ex.workout.date, sets: [] });
    }
    workoutMap.get(wid)!.sets.push(...ex.sets);
  }

  const workouts = Array.from(workoutMap.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  if (workouts.length === 0) {
    return NextResponse.json({ lastBestSet: null, prevBestSet: null, suggestion: null, isPR: false });
  }

  /**
   * Given the sets of one workout session, return the single best set:
   * - Exclude warmup sets: any set whose weight < 70 % of the session's max weight
   * - Among the remaining sets pick the one with the highest weight × reps volume
   */
  function getBestSet(sets: (typeof occurrences)[0]["sets"]): { weight: number; reps: number } | null {
    const valid = sets.filter((s) => s.weight && s.reps);
    if (valid.length === 0) return null;

    const maxWeight = Math.max(...valid.map((s) => s.weight!));
    const threshold = maxWeight * 0.7;
    const workSets = valid.filter((s) => s.weight! >= threshold);
    if (workSets.length === 0) return null;

    let best: { weight: number; reps: number } | null = null;
    let bestVolume = 0;
    for (const s of workSets) {
      const volume = s.weight! * s.reps!;
      if (volume > bestVolume) {
        bestVolume = volume;
        best = { weight: s.weight!, reps: s.reps! };
      }
    }
    return best;
  }

  const lastBestSet = getBestSet(workouts[0].sets);
  const prevBestSet = workouts.length > 1 ? getBestSet(workouts[1].sets) : null;

  if (!lastBestSet) {
    return NextResponse.json({ lastBestSet: null, prevBestSet: null, suggestion: null, isPR: false });
  }

  const lastVolume = lastBestSet.weight * lastBestSet.reps;
  const prevVolume = prevBestSet ? prevBestSet.weight * prevBestSet.reps : null;
  const isPR = prevVolume !== null && lastVolume > prevVolume;

  // Build suggestion only when we have 2+ workouts and it's NOT a PR
  let suggestion: string | null = null;
  if (prevBestSet && !isPR) {
    if (lastBestSet.reps < 10) {
      suggestion = `${lastBestSet.weight}kg x ${lastBestSet.reps + 2} tekrar dene`;
    } else {
      suggestion = `${lastBestSet.weight + 2}kg x 8 tekrar dene`;
    }
  }

  return NextResponse.json({ exerciseName, lastBestSet, prevBestSet, suggestion, isPR });
}
