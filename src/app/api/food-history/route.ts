import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFoodHistory, type HistoryLogInput } from "@/lib/food-history";

// Recently logged foods (any day, any meal type), newest first, one row per food.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.mealLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      quantity: true,
      mealType: true,
      createdAt: true,
      mealSnapshot: true,
      meal: {
        select: {
          id: true, name: true, calories: true, protein: true, carbs: true, fat: true,
          servingSize: true, servingLabel: true, imageUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ items: buildFoodHistory(logs as unknown as HistoryLogInput[]) });
}
