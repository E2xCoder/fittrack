import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      height: true,
      weight: true,
      stepTarget: true,
      waterTarget: true,
      sleepTarget: true,
      timezone: true,
    },
  });

  const userTz = userProfile?.timezone ?? "Europe/Berlin";

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone(userTz);

  if (dateParam) date.setHours(0, 0, 0, 0);

  const bodyLog = await prisma.bodyLog.findFirst({
    where: { userId: user.id, date },
  });

  return NextResponse.json({ bodyLog, userProfile });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const dateParam = body.date;

  // Calculate calories burned from steps
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { weight: true, timezone: true },
  });

  const userTz = userProfile?.timezone ?? "Europe/Berlin";
  const weight = userProfile?.weight ?? 70;
  const steps = Number(body.steps) || 0;
  const caloriesBurned = Math.round(steps * 0.04 * (weight / 70));

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone(userTz);

  if (dateParam) date.setHours(0, 0, 0, 0);

  const bodyLog = await prisma.bodyLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: {
      weight: body.weight ? Number(body.weight) : undefined,
      steps: body.steps ? Number(body.steps) : undefined,
      water: body.water ? Number(body.water) : undefined,
      sleep: body.sleep ? Number(body.sleep) : undefined,
      waist: body.waist ? Number(body.waist) : undefined,
      chest: body.chest ? Number(body.chest) : undefined,
      hip: body.hip ? Number(body.hip) : undefined,
      arm: body.arm ? Number(body.arm) : undefined,
      leg: body.leg ? Number(body.leg) : undefined,
      bodyFat: body.bodyFat ? Number(body.bodyFat) : undefined,
      caloriesBurned,
    },
    create: {
      userId: user.id,
      date,
      weight: body.weight ? Number(body.weight) : null,
      steps: body.steps ? Number(body.steps) : null,
      water: body.water ? Number(body.water) : null,
      sleep: body.sleep ? Number(body.sleep) : null,
      waist: body.waist ? Number(body.waist) : null,
      chest: body.chest ? Number(body.chest) : null,
      hip: body.hip ? Number(body.hip) : null,
      arm: body.arm ? Number(body.arm) : null,
      leg: body.leg ? Number(body.leg) : null,
      bodyFat: body.bodyFat ? Number(body.bodyFat) : null,
      caloriesBurned,
    },
  });

  // Update user's current weight if provided
  if (body.weight) {
    await prisma.user.update({
      where: { id: user.id },
      data: { weight: Number(body.weight) },
    });
  }

  return NextResponse.json({ success: true, bodyLog });
}
