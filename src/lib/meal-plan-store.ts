import type { PrismaClient } from "@prisma/client";
import type { Macros, PlanDay } from "./meal-plan";

// Persistence for the user's current meal plan (one row per user). Relative
// import above on purpose: this file is exercised by vitest, which has no "@/" alias.

export interface StoredMealPlan {
  startDate: string;
  target: Macros;
  days: PlanDay[];
  loggedDays: number[];
}

export async function getMealPlan(db: PrismaClient, userId: string): Promise<StoredMealPlan | null> {
  const row = await db.mealPlan.findUnique({ where: { userId } });
  if (!row) return null;
  return {
    startDate: row.startDate,
    target: row.target as unknown as Macros,
    days: row.days as unknown as PlanDay[],
    loggedDays: [...new Set(row.loggedDays)].sort((a, b) => a - b),
  };
}

/** Replaces the user's plan; the "already logged" marks start over with it. */
export async function saveMealPlan(
  db: PrismaClient,
  userId: string,
  plan: { startDate: string; target: Macros; days: PlanDay[] }
): Promise<StoredMealPlan> {
  const data = {
    startDate: plan.startDate,
    target: plan.target as object,
    days: plan.days as unknown as object,
    loggedDays: [] as number[],
  };
  await db.mealPlan.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { ...plan, loggedDays: [] };
}

/** Remembers that plan day `index` was written to the diary. Returns false if there is no such day. */
export async function markDayLogged(db: PrismaClient, userId: string, index: number): Promise<boolean> {
  const row = await db.mealPlan.findUnique({ where: { userId }, select: { days: true, loggedDays: true } });
  if (!row || !Number.isInteger(index) || index < 0 || index >= (row.days as unknown as unknown[]).length) return false;
  if (!row.loggedDays.includes(index)) {
    await db.mealPlan.update({ where: { userId }, data: { loggedDays: { push: index } } });
  }
  return true;
}

export async function clearMealPlan(db: PrismaClient, userId: string): Promise<void> {
  await db.mealPlan.deleteMany({ where: { userId } });
}
