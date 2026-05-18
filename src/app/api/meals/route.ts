import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meals = await prisma.meal.findMany({
    where: { userId: user.id },
    orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(meals);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name || !body.calories) {
    return NextResponse.json({ error: "Name and calories required" }, { status: 400 });
  }

  const meal = await prisma.meal.create({
    data: {
      userId: user.id,
      name: body.name,
      calories: Number(body.calories),
      protein: Number(body.protein) || 0,
      carbs: Number(body.carbs) || 0,
      fat: Number(body.fat) || 0,
      fiber: Number(body.fiber) || 0,
      sodium: Number(body.sodium) || 0,
      servingSize: Number(body.servingSize) || 1,
      servingLabel: body.servingLabel || "piece",
      category: body.category || "SNACK",
      isFavorite: Boolean(body.isFavorite),
    },
  });

  return NextResponse.json(meal);
}