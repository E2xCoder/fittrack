import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

// Add meal to pack
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: packId } = await context.params;
  const body = await request.json();

  // Verify pack ownership
  const pack = await prisma.mealPack.findFirst({ where: { id: packId, userId: user.id } });
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify meal ownership
  const meal = await prisma.meal.findFirst({ where: { id: body.mealId, userId: user.id } });
  if (!meal) return NextResponse.json({ error: "Meal not found" }, { status: 404 });

  const item = await prisma.mealPackItem.create({
    data: {
      packId,
      mealId: body.mealId,
      quantity: Number(body.quantity) || 1,
    },
    include: { meal: true },
  });

  return NextResponse.json(item);
}

// Remove meal from pack
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: packId } = await context.params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const pack = await prisma.mealPack.findFirst({ where: { id: packId, userId: user.id } });
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.mealPackItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}