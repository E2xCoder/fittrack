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
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      onboardingCompleted: true,
      calorieTarget: true,
      proteinTarget: true,
      carbTarget: true,
      fatTarget: true,
      height: true,
      weight: true,
      age: true,
      gender: true,
      activityLevel: true,
      goal: true,
      dietaryPreferences: true,
      mealsPerDay: true,
    },
  });

  return NextResponse.json(user);
}
