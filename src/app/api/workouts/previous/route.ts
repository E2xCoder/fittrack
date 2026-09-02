import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const exerciseName = searchParams.get("exercise") ?? "";

  const userTzRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const today = getTodayInTimezone(userTzRow?.timezone ?? "Europe/Berlin");

  const lastExercise = await prisma.exercise.findFirst({
    where: {
      userId: session.user.id,
      name: { contains: exerciseName },
      workout: {
        date: { lt: today }, // exclude today
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      sets: { orderBy: { setNumber: "asc" } },
      workout: { select: { date: true } },
    },
  });

  if (!lastExercise) return NextResponse.json({ previous: null });

  return NextResponse.json({
    previous: {
      date: lastExercise.workout.date,
      sets: lastExercise.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        sets: s.sets,
        rpe: s.rpe,
        isPR: s.isPR,
      })),
    },
  });
}