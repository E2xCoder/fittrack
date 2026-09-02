import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayInTimezone } from "@/lib/date";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      height: true,
      weight: true,
      stepTarget: true,
      waterTarget: true,
      sleepTarget: true,
      timezone: true,
    },
  });

  const userTz = userProfile?.timezone ?? "Europe/Berlin";

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone(userTz);

  if (dateParam) date.setHours(0, 0, 0, 0);

  const bodyLog = await prisma.bodyLog.findFirst({
    where: { userId: user.id, date },
  });

  return NextResponse.json({ bodyLog, userProfile });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const dateParam = body.date;

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { weight: true, timezone: true },
  });

  const userTz = userProfile?.timezone ?? "Europe/Berlin";
  const weight = userProfile?.weight ?? 70;

  const date = dateParam
    ? new Date(dateParam + "T12:00:00")
    : getTodayInTimezone(userTz);

  if (dateParam) date.setHours(0, 0, 0, 0);

  // Build a partial payload: only fields actually present in the request are
  // touched, so a targeted update (e.g. a water quick-add from the dashboard)
  // never wipes steps/weight/sleep. An explicit empty value still clears a
  // field, preserving the Body form's "clear" behaviour.
  const NUMERIC_FIELDS = [
    "weight", "steps", "water", "sleep",
    "waist", "chest", "hip", "arm", "leg", "bodyFat",
  ] as const;

  const data: Record<string, number | null> = {};
  for (const field of NUMERIC_FIELDS) {
    if (field in body) {
      const raw = body[field];
      data[field] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
    }
  }

  // Recompute calories burned only when steps are part of this update.
  if ("steps" in body) {
    const steps = Number(body.steps) || 0;
    data.caloriesBurned = Math.round(steps * 0.04 * (weight / 70));
  }

  const bodyLog = await prisma.bodyLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: data,
    create: { userId: user.id, date, ...data },
  });

  // Update user's current weight if a real weight value was provided.
  if ("weight" in body && body.weight) {
    await prisma.user.update({
      where: { id: user.id },
      data: { weight: Number(body.weight) },
    });
  }

  return NextResponse.json({ success: true, bodyLog });
}
