import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const {
    name,
    goal,
    height,
    weight,
    age,
    gender,
    activityLevel,
    dietaryPreferences,
    mealsPerDay,
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    gymDays,
    splits,
  } = await req.json();

  // Update user profile
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name ?? undefined,
      goal: goal ?? undefined,
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      age: age ? Number(age) : undefined,
      gender: gender ?? undefined,
      activityLevel: activityLevel ?? undefined,
      dietaryPreferences: dietaryPreferences ?? [],
      mealsPerDay: mealsPerDay ? Number(mealsPerDay) : 3,
      calorieTarget: calorieTarget ? Number(calorieTarget) : undefined,
      proteinTarget: proteinTarget ? Number(proteinTarget) : undefined,
      carbTarget: carbTarget ? Number(carbTarget) : undefined,
      fatTarget: fatTarget ? Number(fatTarget) : undefined,
      onboardingCompleted: true,
    },
  });

  // Log initial weight
  if (weight) {
    await prisma.weightLog.create({
      data: { userId, weight: Number(weight) },
    }).catch(() => {}); // ignore duplicate
  }

  // Create default splits if user specified gym days
  if (splits && Array.isArray(splits) && splits.length > 0) {
    // Delete existing splits first
    await prisma.userSplit.deleteMany({ where: { userId } });

    await prisma.userSplit.createMany({
      data: splits.map((s: { name: string; emoji: string }, i: number) => ({
        userId,
        name: s.name,
        emoji: s.emoji,
        orderIndex: i,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
