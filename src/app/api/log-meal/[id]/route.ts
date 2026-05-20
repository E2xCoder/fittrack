import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const mealLog = await prisma.mealLog.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!mealLog) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (mealLog.dailyLogId) {
    await prisma.dailyLog.update({
      where: { id: mealLog.dailyLogId },
      data: {
        totalCalories: { decrement: mealLog.calories },
        totalProtein: { decrement: mealLog.protein },
        totalCarbs: { decrement: mealLog.carbs },
        totalFat: { decrement: mealLog.fat },
      },
    });
  }

  await prisma.mealLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  const mealLog = await prisma.mealLog.findFirst({
    where: { id, userId: user.id },
    include: { meal: true },
  });
  if (!mealLog) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meal = mealLog.meal;
  if (!meal) return NextResponse.json({ error: "Original meal deleted" }, { status: 400 });

  const newQuantity = Number(body.quantity);
  if (newQuantity <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

  const newCalories = meal.calories * newQuantity;
  const newProtein = meal.protein * newQuantity;
  const newCarbs = meal.carbs * newQuantity;
  const newFat = meal.fat * newQuantity;

  // Update daily log totals — remove old, add new
  if (mealLog.dailyLogId) {
    await prisma.dailyLog.update({
      where: { id: mealLog.dailyLogId },
      data: {
        totalCalories: { increment: newCalories - mealLog.calories },
        totalProtein: { increment: newProtein - mealLog.protein },
        totalCarbs: { increment: newCarbs - mealLog.carbs },
        totalFat: { increment: newFat - mealLog.fat },
      },
    });
  }

  const updated = await prisma.mealLog.update({
    where: { id },
    data: {
      quantity: newQuantity,
      calories: newCalories,
      protein: newProtein,
      carbs: newCarbs,
      fat: newFat,
    },
  });

  return NextResponse.json(updated);
}