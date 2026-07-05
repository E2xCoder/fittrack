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

  // Per-session best-set volume, oldest → newest, for the sparkline.
  const history = [...workouts]
    .reverse()
    .map((w) => {
      const best = getBestSet(w.sets);
      return best ? { date: w.date, volume: best.weight * best.reps } : null;
    })
    .filter((h): h is { date: Date; volume: number } => h !== null)
    .slice(-6);

  if (!lastBestSet) {
    return NextResponse.json({
      lastBestSet: null, prevBestSet: null, suggestion: null,
      isPR: false, est1RM: null, history, plateauWeeks: 0,
    });
  }

  const lastVolume = lastBestSet.weight * lastBestSet.reps;
  const prevVolume = prevBestSet ? prevBestSet.weight * prevBestSet.reps : null;
  const isPR = prevVolume !== null && lastVolume > prevVolume;

  // Estimated 1-rep max — Epley formula.
  const est1RM = Math.round(lastBestSet.weight * (1 + lastBestSet.reps / 30));

  // Plateau: how long the best-set volume has failed to exceed its running max.
  let plateauWeeks = 0;
  if (history.length >= 3) {
    let peak = 0;
    let peakDate = history[0].date;
    let stalledSince: Date | null = null;
    for (const h of history) {
      if (h.volume > peak) {
        peak = h.volume;
        peakDate = h.date;
        stalledSince = null;
      } else if (stalledSince === null) {
        stalledSince = peakDate;
      }
    }
    const newestVolume = history[history.length - 1].volume;
    if (newestVolume <= peak && stalledSince) {
      const days = Math.round((today.getTime() - new Date(stalledSince).getTime()) / 86400000);
      plateauWeeks = Math.floor(days / 7);
    }
  }

  // Build suggestion only when we have 2+ workouts and it's NOT a PR
  let suggestion: string | null = null;
  if (prevBestSet && !isPR) {
    if (lastBestSet.reps < 10) {
      suggestion = `${lastBestSet.weight}kg x ${lastBestSet.reps + 2} tekrar dene`;
    } else {
      suggestion = `${lastBestSet.weight + 2}kg x 8 tekrar dene`;
    }
  }

  return NextResponse.json({
    exerciseName, lastBestSet, prevBestSet, suggestion, isPR,
    est1RM, history, plateauWeeks,
  });
}
