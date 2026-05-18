import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workouts = await prisma.workout.findMany({
    where: { userId: user.id },
    include: {
      exercises: {
        include: { sets: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(workouts);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      title: body.title ?? "Workout",
      notes: body.notes ?? "",
      exercises: {
        create: (body.exercises ?? []).map((exercise: any) => ({
          name: exercise.name,
          userId: user.id,
          sets: {
            create: (exercise.sets ?? []).map((set: any) => ({
              weight: set.weight ?? null,
              reps: set.reps ?? null,
            })),
          },
        })),
      },
    },
    include: {
      exercises: { include: { sets: true } },
    },
  });

  return NextResponse.json(workout);
}