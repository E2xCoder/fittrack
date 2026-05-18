import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  const meal = await prisma.meal.findFirst({ where: { id, userId: user.id } });
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.meal.update({
    where: { id },
    data: {
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

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const meal = await prisma.meal.findFirst({ where: { id, userId: user.id } });
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.meal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}