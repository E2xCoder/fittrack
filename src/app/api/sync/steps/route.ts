import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { apiToken: token },
    select: { id: true, weight: true },
  });

  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json();
  const steps = Number(body.steps) || 0;
  const dateParam = body.date;

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone();

  if (dateParam) date.setHours(0, 0, 0, 0);

  const weight = user.weight ?? 70;
  const caloriesBurned = Math.round(steps * 0.04 * (weight / 70));

  await prisma.bodyLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { steps, caloriesBurned },
    create: {
      userId: user.id,
      date,
      steps,
      caloriesBurned,
    },
  });

  return NextResponse.json({ success: true, steps, caloriesBurned });
}