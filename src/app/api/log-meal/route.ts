import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user;
  const body = await request.json();
  const quantity = Number(body.quantity) || 1;

  const meal = await prisma.meal.findFirst({
    where: { id: body.mealId, userId: user.id },
  });
  if (!meal) return NextResponse.json({ error: "Meal not found" }, { status: 404 });

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

  const calories = meal.calories * quantity;
  const protein = meal.protein * quantity;
  const carbs = meal.carbs * quantity;
  const fat = meal.fat * quantity;

  const mealSnapshot = {
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    servingLabel: meal.servingLabel,
    servingSize: meal.servingSize,
  };

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
      mealSnapshot,
    },
  });

  await prisma.dailyLog.update({
    where: { id: dailyLog.id },
    data: {
      totalCalories: { increment: calories },
      totalProtein: { increment: protein },
      totalCarbs: { increment: carbs },
      totalFat: { increment: fat },
    },
  });

  return NextResponse.json({ success: true });
}