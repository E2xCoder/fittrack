import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  { name: "Breakfast", emoji: "🌅" },
  { name: "Lunch", emoji: "☀️" },
  { name: "Dinner", emoji: "🌙" },
  { name: "Pre-Workout", emoji: "💪" },
  { name: "Post-Workout", emoji: "🏋️" },
  { name: "Snack", emoji: "🍎" },
  { name: "Shake", emoji: "🥤" },
];

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let categories = await prisma.userMealCategory.findMany({
    where: { userId: session.user.id },
    orderBy: { orderIndex: "asc" },
  });

  if (categories.length === 0) {
    categories = await Promise.all(
      DEFAULT_CATEGORIES.map((c, i) =>
        prisma.userMealCategory.create({
          data: { userId: session.user.id, name: c.name, emoji: c.emoji, orderIndex: i },
        })
      )
    );
  }

  const [meals, packs, recentLogs] = await Promise.all([
    prisma.meal.findMany({
      where: { userId: session.user.id },
      include: { category: true },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "desc" }],
    }),
    prisma.mealPack.findMany({
      where: { userId: session.user.id },
      include: { items: { include: { meal: { include: { category: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mealLog.findMany({
      where: { userId: session.user.id, mealId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { mealId: true },
    }),
  ]);

  // Distinct meal ids in recency order — powers the "Recent" filter and the
  // "recently consumed" quick-add row on the client.
  const recentMealIds = [...new Set(recentLogs.map((l) => l.mealId))]
    .filter((id): id is string => !!id)
    .slice(0, 12);

  return NextResponse.json({ meals, packs, categories, recentMealIds });
}