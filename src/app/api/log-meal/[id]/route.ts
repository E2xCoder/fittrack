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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const mealLog = await prisma.mealLog.findFirst({
    where: { id, userId: user.id },
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

  const newQuantity = Number(body.quantity);
  if (newQuantity <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

  // Base macros come from the library meal, or fall back to the stored snapshot
  // (ad-hoc logs whose meal was never saved, or whose meal was later deleted).
  const snapshot = mealLog.mealSnapshot as {
    calories?: number; protein?: number; carbs?: number; fat?: number;
  } | null;
  const base = mealLog.meal ?? snapshot;
  if (!base) return NextResponse.json({ error: "Original meal deleted" }, { status: 400 });

  const newCalories = (base.calories ?? 0) * newQuantity;
  const newProtein = (base.protein ?? 0) * newQuantity;
  const newCarbs = (base.carbs ?? 0) * newQuantity;
  const newFat = (base.fat ?? 0) * newQuantity;

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

  await prisma.mealLog.update({
    where: { id },
    data: {
      quantity: newQuantity,
      calories: newCalories,
      protein: newProtein,
      carbs: newCarbs,
      fat: newFat,
    },
  });

  return NextResponse.json({ success: true });
}