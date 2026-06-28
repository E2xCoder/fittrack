import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

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
  const today = getTodayInTimezone(userTzRow?.timezone ?? "Europe/Berlin");
  const split = body.split ?? "Rest Day";

  // Find existing workout for today AND this specific split
  const existing = await prisma.workout.findFirst({
    where: { userId: user.id, date: today, split },
  });

  if (existing) {
    await prisma.exercise.deleteMany({ where: { workoutId: existing.id } });

    const workout = await prisma.workout.update({
      where: { id: existing.id },
      data: {
        notes: body.notes ?? "",
        exercises: {
          create: (body.exercises ?? []).map((exercise: any, index: number) => ({
            name: exercise.name,
            userId: user.id,
            orderIndex: index,
            sets: {
              create: (exercise.sets ?? []).map((set: any, i: number) => ({
                setNumber: i + 1,
                weight: set.weight ?? null,
                reps: set.reps ?? null,
                sets: set.sets ?? 1,
                rpe: set.rpe ?? null,
              })),
            },
          })),
        },
      },
      include: { exercises: { include: { sets: true } } },
    });

    return NextResponse.json(workout);
  }

  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      split,
      notes: body.notes ?? "",
      date: today,
      exercises: {
        create: (body.exercises ?? []).map((exercise: any, index: number) => ({
          name: exercise.name,
          userId: user.id,
          orderIndex: index,
          sets: {
            create: (exercise.sets ?? []).map((set: any, i: number) => ({
              setNumber: i + 1,
              weight: set.weight ?? null,
              reps: set.reps ?? null,
              sets: set.sets ?? 1,
              rpe: set.rpe ?? null,
            })),
          },
        })),
      },
    },
    include: { exercises: { include: { sets: true } } },
  });

  return NextResponse.json(workout);
}