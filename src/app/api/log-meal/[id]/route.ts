import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
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

  const { id } =
    await context.params;

  const mealLog =
    await prisma.mealLog.findUnique({
      where: { id },
    });

  if (!mealLog) {
    return NextResponse.json(
      {
        error:
          "Not found",
      },
      { status: 404 }
    );
  }

  await prisma.dailyLog.update({
    where: {
      id:
        mealLog.dailyLogId!,
    },
    data: {
      totalCalories: {
        decrement:
          mealLog.calories,
      },
      totalProtein: {
        decrement:
          mealLog.protein,
      },
      totalCarbs: {
        decrement:
          mealLog.carbs,
      },
      totalFat: {
        decrement:
          mealLog.fat,
      },
    },
  });

  await prisma.mealLog.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
  });
}