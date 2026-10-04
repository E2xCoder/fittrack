import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";
import { saveWorkout } from "@/lib/workout-save";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workouts = await prisma.workout.findMany({
    where: { userId: user.id },
    include: { exercises: { include: { sets: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(workouts);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const userTzRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });

  let date: Date;
  if (body.date) {
    date = new Date(`${body.date}T12:00:00`);
    date.setHours(0, 0, 0, 0);
  } else {
    date = getTodayInTimezone(userTzRow?.timezone ?? "Europe/Berlin");
  }
  const split = body.split ?? "Rest Day";

  const workout = await saveWorkout(prisma, {
    userId: user.id,
    date,
    split,
    notes: body.notes ?? "",
    exercises: body.exercises ?? [],
  });

  return NextResponse.json(workout);
}