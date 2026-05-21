import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const dateParam = body.date;

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone();

  if (dateParam) date.setHours(0, 0, 0, 0);

  const userId = session.user.id;

  let dailyLog = await prisma.dailyLog.findFirst({
    where: { userId, date },
  });

  if (!dailyLog) {
    dailyLog = await prisma.dailyLog.create({
      data: { userId, date },
    });
  }

  const updated = await prisma.dailyLog.update({
    where: { id: dailyLog.id },
    data: {
      isGymDay: body.isGymDay ?? dailyLog.isGymDay,
      gymSplit: body.gymSplit ?? dailyLog.gymSplit,
    },
  });

  return NextResponse.json(updated);
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone();

  if (dateParam) date.setHours(0, 0, 0, 0);

  const dailyLog = await prisma.dailyLog.findFirst({
    where: { userId: session.user.id, date },
  });

  return NextResponse.json({ dailyLog });
}