import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const split = searchParams.get("split");

  const splits = await prisma.userSplit.findMany({
    where: { userId: session.user.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, emoji: true },
  });

  // Seed defaults if none
  let finalSplits = splits;
  if (splits.length === 0) {
    const defaults = [
      { name: "Arms & Forearms", emoji: "💪" },
      { name: "Shoulders & Triceps", emoji: "🏋️" },
      { name: "Chest & Back", emoji: "🔥" },
      { name: "Legs & Abs", emoji: "🦵" },
      { name: "Rest Day", emoji: "😴" },
    ];
    finalSplits = await Promise.all(
      defaults.map((d, i) =>
        prisma.userSplit.create({
          data: { userId: session.user.id, name: d.name, emoji: d.emoji, orderIndex: i },
          select: { id: true, name: true, emoji: true },
        })
      )
    );
  }

  // İlk split veya gönderilen split için workout getir
  const targetSplit = split ?? (finalSplits[0]?.name ?? null);

  const workout = targetSplit ? await prisma.workout.findFirst({
    where: { userId: session.user.id, split: targetSplit },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  }) : null;

  return NextResponse.json({ splits: finalSplits, workout: workout ?? null, activeSplit: targetSplit });
}