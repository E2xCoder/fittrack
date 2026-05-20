import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = getTodayInTimezone();

  const workout = await prisma.workout.findFirst({
    where: { userId: session.user.id, date: today },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workout: workout ?? null });
}