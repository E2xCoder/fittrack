import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: packId } = await context.params;
  const body = await request.json();

  const pack = await prisma.mealPack.findFirst({ where: { id: packId, userId: user.id } });
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meal = await prisma.meal.findFirst({ where: { id: body.mealId, userId: user.id } });
  if (!meal) return NextResponse.json({ error: "Meal not found" }, { status: 404 });

  const item = await prisma.mealPackItem.create({
    data: { packId, mealId: body.mealId, quantity: Number(body.quantity) || 1 },
    include: { meal: true },
  });

  return NextResponse.json(item);
}

// Update quantity of item in pack
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: packId } = await context.params;
  const body = await request.json();
  const { itemId, quantity } = body;

  if (!itemId || !quantity) return NextResponse.json({ error: "itemId and quantity required" }, { status: 400 });

  const pack = await prisma.mealPack.findFirst({ where: { id: packId, userId: user.id } });
  if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const q = Number(quantity);
  if (!(q > 0) || q > 100000) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

  // The item must belong to this (the user's own) pack.
  const result = await prisma.mealPackItem.updateMany({ where: { id: itemId, packId }, data: { quantity: q } });
  if (result.count === 0) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  return NextResponse.json(await prisma.mealPackItem.findUnique({ where: { id: itemId }, include: { meal: true } }));
}

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

  const result = await prisma.mealPackItem.deleteMany({ where: { id: itemId, packId } });
  if (result.count === 0) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}