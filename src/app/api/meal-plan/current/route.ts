import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearMealPlan, getMealPlan, markDayLogged } from "@/lib/meal-plan-store";

async function userId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

// The saved plan (or null). No AI involved, so it works regardless of the AI flag.
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ plan: await getMealPlan(prisma, id) });
}

// { loggedDay: number } — remember that this plan day was written to the diary.
export async function PATCH(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ok = await markDayLogged(prisma, id, Number(body.loggedDay));
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "No such plan day" }, { status: 404 });
}

export async function DELETE() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearMealPlan(prisma, id);
  return NextResponse.json({ success: true });
}
