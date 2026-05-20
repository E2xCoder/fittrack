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
  const today = getTodayInTimezone();

  // Check if workout already exists for today — update instead of create
  const existing = await prisma.workout.findFirst({
    where: { userId: user.id, date: today },
  });

  if (existing) {
    await prisma.exercise.deleteMany({ where: { workoutId: existing.id } });

    const workout = await prisma.workout.update({
      where: { id: existing.id },
      data: {
        split: body.split ?? existing.split,
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
      split: body.split ?? "Rest Day",
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