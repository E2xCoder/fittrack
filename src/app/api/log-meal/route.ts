import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user;
  const body = await request.json();
  const quantity = Number(body.quantity) || 1;

  // Resolve the nutrition base + display snapshot from one of two sources:
  //  • an existing library meal (body.mealId), or
  //  • an ad-hoc payload (name + macros) — logs to the day WITHOUT saving a Meal.
  let mealId: string | null = null;
  let base: { calories: number; protein: number; carbs: number; fat: number };
  let snapshot: {
    name: string; calories: number; protein: number; carbs: number; fat: number;
    servingLabel: string; servingSize: number;
  };

  if (body.mealId) {
    const meal = await prisma.meal.findFirst({
      where: { id: body.mealId, userId: user.id },
    });
    if (!meal) return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    mealId = meal.id;
    base = { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
    snapshot = {
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      servingLabel: meal.servingLabel,
      servingSize: meal.servingSize,
    };
  } else if (typeof body.name === "string" && body.name.trim()) {
    base = {
      calories: Number(body.calories) || 0,
      protein:  Number(body.protein)  || 0,
      carbs:    Number(body.carbs)    || 0,
      fat:      Number(body.fat)      || 0,
    };
    snapshot = {
      name: body.name.trim(),
      ...base,
      servingLabel: typeof body.servingLabel === "string" ? body.servingLabel : "g",
      servingSize:  Number(body.servingSize) || 100,
    };
  } else {
    return NextResponse.json({ error: "Missing mealId or meal data" }, { status: 400 });
  }

  const userTzRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });
  const userTz = userTzRow?.timezone ?? "Europe/Berlin";

  let logDate: Date;
  if (body.date) {
    logDate = new Date(body.date + "T12:00:00");
    logDate.setHours(0, 0, 0, 0);
  } else {
    logDate = getTodayInTimezone(userTz);
  }

  let dailyLog = await prisma.dailyLog.findFirst({
    where: { userId: user.id, date: logDate },
  });

  if (!dailyLog) {
    dailyLog = await prisma.dailyLog.create({
      data: { userId: user.id, date: logDate },
    });
  }

  const calories = base.calories * quantity;
  const protein = base.protein * quantity;
  const carbs = base.carbs * quantity;
  const fat = base.fat * quantity;

  // Merge into an existing entry only for library meals (identified by mealId).
  // Ad-hoc entries (mealId null) always create a fresh row.
  const existing = mealId
    ? await prisma.mealLog.findFirst({
        where: {
          dailyLogId: dailyLog.id,
          mealId,
          userId: user.id,
        },
      })
    : null;

  if (existing) {
    // Merge: add to existing entry
    await prisma.mealLog.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + quantity,
        calories: existing.calories + calories,
        protein: existing.protein + protein,
        carbs: existing.carbs + carbs,
        fat: existing.fat + fat,
      },
    });
  } else {
    // New entry
    await prisma.mealLog.create({
      data: {
        mealId,
        userId: user.id,
        dailyLogId: dailyLog.id,
        quantity,
        calories,
        protein,
        carbs,
        fat,
        mealSnapshot: snapshot,
      },
    });
  }

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