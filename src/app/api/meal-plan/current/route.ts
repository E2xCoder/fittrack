import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearMealPlan, getMealPlan, markDayLogged, replacePlanDay } from "@/lib/meal-plan-store";
import { buildDay } from "@/lib/meal-plan";

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

// { dayIndex, meals: [{ slot, items: [{ mealId, quantity }] }] } — a hand-edited day.
// Only ids and quantities are trusted; every number is rebuilt from the user's own meals.
export async function PUT(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { dayIndex?: unknown; meals?: unknown };
  const dayIndex = Number(body.dayIndex);
  const rawMeals = Array.isArray(body.meals) ? body.meals : null;
  if (!rawMeals || rawMeals.length > 8 || rawMeals.some((m) => !m || !Array.isArray((m as { items?: unknown }).items) || (m as { items: unknown[] }).items.length > 12)) {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }

  const plan = await getMealPlan(prisma, id);
  if (!plan || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days.length) {
    return NextResponse.json({ error: "No such plan day" }, { status: 404 });
  }
  if (plan.loggedDays.includes(dayIndex)) {
    return NextResponse.json({ error: "This day is already logged to your diary." }, { status: 409 });
  }

  const ids = [...new Set(rawMeals.flatMap((m) => (m as { items: { mealId?: unknown }[] }).items.map((i) => i?.mealId)).filter((x): x is string => typeof x === "string"))];
  const library = await prisma.meal.findMany({
    where: { userId: id, id: { in: ids } },
    select: { id: true, name: true, calories: true, protein: true, carbs: true, fat: true, servingSize: true, servingLabel: true },
  });

  const day = buildDay(rawMeals, library);
  await replacePlanDay(prisma, id, dayIndex, day);
  return NextResponse.json({ day });
}

export async function DELETE() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearMealPlan(prisma, id);
  return NextResponse.json({ success: true });
}
