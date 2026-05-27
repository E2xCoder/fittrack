import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let categories = await prisma.userMealCategory.findMany({
    where: { userId: user.id },
    orderBy: { orderIndex: "asc" },
  });

  // Seed defaults if none
  if (categories.length === 0) {
    categories = await Promise.all(
      DEFAULT_CATEGORIES.map((c, i) =>
        prisma.userMealCategory.create({
          data: { userId: user.id, name: c.name, emoji: c.emoji, orderIndex: i },
        })
      )
    );
  }

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const count = await prisma.userMealCategory.count({ where: { userId: user.id } });

  const category = await prisma.userMealCategory.create({
    data: {
      userId: user.id,
      name: body.name,
      emoji: body.emoji ?? "🍽️",
      orderIndex: count,
    },
  });

  return NextResponse.json(category);
}