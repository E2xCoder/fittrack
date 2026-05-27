import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meals = await prisma.meal.findMany({
    where: { userId: session.user.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(meals);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const meal = await prisma.meal.create({
    data: {
      userId: session.user.id,
      name: body.name,
      calories: body.calories,
      protein: body.protein ?? 0,
      carbs: body.carbs ?? 0,
      fat: body.fat ?? 0,
      fiber: body.fiber ?? null,
      sodium: body.sodium ?? null,
      servingSize: body.servingSize ?? 1,
      servingLabel: body.servingLabel ?? "piece",
      categoryId: body.categoryId ?? null,
      isFavorite: body.isFavorite ?? false,
    },
  });

  return NextResponse.json(meal);
}