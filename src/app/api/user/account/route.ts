import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cascade deletes on User handle: workouts, exercises, sets, meals, mealLogs,
  // dailyLogs, bodyLogs, weightLogs, pushSubscriptions, sessions, accounts, etc.
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
