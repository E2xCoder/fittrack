import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const split = searchParams.get("split");
  const dateParam = searchParams.get("date");

  const userTzRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const userTz = userTzRow?.timezone ?? "Europe/Berlin";
  const today = getTodayInTimezone(userTz);

  let targetDate: Date;
  if (dateParam) {
    targetDate = new Date(`${dateParam}T12:00:00`);
    targetDate.setHours(0, 0, 0, 0);
  } else {
    targetDate = today;
  }
  const isToday = targetDate.getTime() === today.getTime();

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

  // Fetch the workout for the first split or the requested split
  const targetSplit = split ?? (finalSplits[0]?.name ?? null);

  const include = {
    exercises: {
      orderBy: { orderIndex: "asc" as const },
      include: { sets: { orderBy: { setNumber: "asc" as const } } },
    },
  };

  let workout = targetSplit ? await prisma.workout.findFirst({
    where: { userId: session.user.id, split: targetSplit, date: targetDate },
    include,
  }) : null;

  // No entry saved for the viewed date yet. Only prefill from the most recent
  // session as a starting template when viewing today — a past/future date
  // with nothing logged should start blank, not silently show today's data.
  if (!workout && targetSplit && isToday) {
    workout = await prisma.workout.findFirst({
      where: { userId: session.user.id, split: targetSplit },
      include,
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({ splits: finalSplits, workout: workout ?? null, activeSplit: targetSplit });
}