import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const dailyLog =
    await prisma.dailyLog.findFirst({
      where: {
        userId:
          session.user.id,
        date: today,
      },
      include: {
        mealLogs: {
          include: {
            meal: true,
          },
          orderBy: {
            createdAt:
              "desc",
          },
        },
      },
    });

  return NextResponse.json({
    totalCalories:
      dailyLog
        ?.totalCalories ?? 0,
    totalProtein:
      dailyLog
        ?.totalProtein ?? 0,
    totalCarbs:
      dailyLog
        ?.totalCarbs ?? 0,
    totalFat:
      dailyLog?.totalFat ??
      0,
    mealLogs:
      dailyLog?.mealLogs ??
      [],
  });
}