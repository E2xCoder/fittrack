import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      calorieTarget: true,
      proteinTarget: true,
      carbTarget: true,
      fatTarget: true,
      height: true,
      weight: true,
      stepTarget: true,
      waterTarget: true,
      sleepTarget: true,
      // Social
      username:      true,
      isPublic:      true,
      shareSteps:    true,
      shareCalories: true,
      shareWorkout:  true,
      shareStreak:   true,
      // Timezone
      timezone:      true,
    },
  });

  return NextResponse.json(user);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name,
      calorieTarget: Number(body.calorieTarget) || null,
      proteinTarget: Number(body.proteinTarget) || null,
      carbTarget: Number(body.carbTarget) || null,
      fatTarget: Number(body.fatTarget) || null,
      height: Number(body.height) || null,
      weight: Number(body.weight) || null,
      stepTarget: Number(body.stepTarget) || 10000,
      waterTarget: Number(body.waterTarget) || 2.5,
      sleepTarget: Number(body.sleepTarget) || 8,
      // Social
      username:      body.username?.trim()  || null,
      isPublic:      body.isPublic      ?? true,
      shareSteps:    body.shareSteps    ?? true,
      shareCalories: body.shareCalories ?? true,
      shareWorkout:  body.shareWorkout  ?? true,
      shareStreak:   body.shareStreak   ?? true,
      // Timezone
      timezone:      body.timezone      || "Europe/Berlin",
    },
  });

  return NextResponse.json({ success: true });
}