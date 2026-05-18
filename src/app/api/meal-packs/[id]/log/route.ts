import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user;
  const { id: packId } = await context.params;

  // Verify pack ownership + get all items
  const pack = await prisma.mealPack.findFirst({
    where: { id: packId, userId: user.id },
    include: { items: { include: { meal: true } } },
  });
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dailyLog = await prisma.dailyLog.findFirst({
    where: { userId: user.id, date: today },
  });
  if (!dailyLog) {
    dailyLog = await prisma.dailyLog.create({
      data: { userId: user.id, date: today },
    });
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  // Log every item in the pack
  for (const item of pack.items) {
    const meal = item.meal;
    const quantity = item.quantity;

    const calories = meal.calories * quantity;
    const protein = meal.protein * quantity;
    const carbs = meal.carbs * quantity;
    const fat = meal.fat * quantity;

    await prisma.mealLog.create({
      data: {
        mealId: meal.id,
        userId: user.id,
        dailyLogId: dailyLog.id,
        quantity,
        calories,
        protein,
        carbs,
        fat,
        mealSnapshot: {
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          servingLabel: meal.servingLabel,
          servingSize: meal.servingSize,
        },
      },
    });

    totalCalories += calories;
    totalProtein += protein;
    totalCarbs += carbs;
    totalFat += fat;
  }

  await prisma.dailyLog.update({
    where: { id: dailyLog.id },
    data: {
      totalCalories: { increment: totalCalories },
      totalProtein: { increment: totalProtein },
      totalCarbs: { increment: totalCarbs },
      totalFat: { increment: totalFat },
    },
  });

  return NextResponse.json({ success: true, totalCalories, totalProtein });
}