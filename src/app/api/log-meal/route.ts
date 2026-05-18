import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request
) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      { status: 401 }
    );
  }

  const body =
    await request.json();

  const quantity =
    Number(
      body.quantity
    ) || 1;

  const meal =
    await prisma.meal.findUnique({
      where: {
        id:
          body.mealId,
      },
    });

  if (!meal) {
    return NextResponse.json(
      {
        error:
          "Meal not found",
      },
      { status: 404 }
    );
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  let dailyLog =
    await prisma.dailyLog.findFirst({
      where: {
        userId:
          session.user.id,
        date: today,
      },
    });

  if (!dailyLog) {
    dailyLog =
      await prisma.dailyLog.create({
        data: {
          userId:
            session.user.id,
          date: today,
        },
      });
  }

  const calories =
    meal.calories *
    quantity;

  const protein =
    meal.protein *
    quantity;

  const carbs =
    meal.carbs *
    quantity;

  const fat =
    meal.fat *
    quantity;

  const existing =
    await prisma.mealLog.findFirst({
      where: {
        mealId:
          meal.id,
        dailyLogId:
          dailyLog.id,
      },
    });

  if (existing) {
    await prisma.mealLog.update({
      where: {
        id:
          existing.id,
      },
      data: {
        quantity: {
          increment:
            quantity,
        },
        calories: {
          increment:
            calories,
        },
        protein: {
          increment:
            protein,
        },
        carbs: {
          increment:
            carbs,
        },
        fat: {
          increment:
            fat,
        },
      },
    });
  } else {
    await prisma.mealLog.create({
      data: {
        mealId:
          meal.id,
        userId:
          session.user.id,
        dailyLogId:
          dailyLog.id,
        quantity,
        calories,
        protein,
        carbs,
        fat,
      },
    });
  }

  await prisma.dailyLog.update({
    where: {
      id:
        dailyLog.id,
    },
    data: {
      totalCalories: {
        increment:
          calories,
      },
      totalProtein: {
        increment:
          protein,
      },
      totalCarbs: {
        increment:
          carbs,
      },
      totalFat: {
        increment:
          fat,
      },
    },
  });

  return NextResponse.json({
    success: true,
  });
}