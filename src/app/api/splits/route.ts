import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_SPLITS = [
  { name: "Arms & Forearms", emoji: "💪" },
  { name: "Shoulders & Triceps", emoji: "🏋️" },
  { name: "Chest & Back", emoji: "🔥" },
  { name: "Legs & Abs", emoji: "🦵" },
  { name: "Rest Day", emoji: "😴" },
];

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let splits = await prisma.userSplit.findMany({
    where: { userId: user.id },
    orderBy: { orderIndex: "asc" },
  });

  // Seed defaults if user has no splits yet
  if (splits.length === 0) {
    splits = await Promise.all(
      DEFAULT_SPLITS.map((s, i) =>
        prisma.userSplit.create({
          data: { userId: user.id, name: s.name, emoji: s.emoji, orderIndex: i },
        })
      )
    );
  }

  return NextResponse.json(splits);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const count = await prisma.userSplit.count({ where: { userId: user.id } });

  const split = await prisma.userSplit.create({
    data: {
      userId: user.id,
      name: body.name,
      emoji: body.emoji || "🏋️",
      orderIndex: count,
    },
  });

  return NextResponse.json(split);
}