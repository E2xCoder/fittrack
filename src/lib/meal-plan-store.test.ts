import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { clearMealPlan, getMealPlan, markDayLogged, saveMealPlan } from "./meal-plan-store";
import type { PlanDay } from "./meal-plan";

// In-memory stand-in for the one table the store touches.
function fakeDb() {
  let row: { userId: string; startDate: string; target: unknown; days: unknown; loggedDays: number[] } | null = null;
  const mealPlan = {
    findUnique: vi.fn(async () => (row ? { ...row } : null)),
    upsert: vi.fn(async ({ create, update }: { create: NonNullable<typeof row>; update: Partial<NonNullable<typeof row>> }) => {
      row = row ? { ...row, ...update } : { ...create };
    }),
    update: vi.fn(async ({ data }: { data: { loggedDays: { push: number } } }) => {
      if (row) row.loggedDays = [...row.loggedDays, data.loggedDays.push];
    }),
    deleteMany: vi.fn(async () => { row = null; }),
  };
  return { db: { mealPlan } as unknown as PrismaClient, mealPlan };
}

const day = (kcal: number): PlanDay =>
  ({ meals: [], totals: { calories: kcal, protein: 0, carbs: 0, fat: 0 } }) as unknown as PlanDay;
const target = { calories: 2000, protein: 120, carbs: 200, fat: 60 };

describe("meal plan store", () => {
  it("returns null when nothing is saved", async () => {
    const { db } = fakeDb();
    expect(await getMealPlan(db, "u1")).toBeNull();
  });

  it("saves a plan and reads it back with no logged days", async () => {
    const { db } = fakeDb();
    await saveMealPlan(db, "u1", { startDate: "2026-10-07", target, days: [day(1900), day(2100)] });
    const plan = await getMealPlan(db, "u1");
    expect(plan?.startDate).toBe("2026-10-07");
    expect(plan?.days).toHaveLength(2);
    expect(plan?.loggedDays).toEqual([]);
  });

  it("marks days once, rejects unknown days", async () => {
    const { db, mealPlan } = fakeDb();
    await saveMealPlan(db, "u1", { startDate: "2026-10-07", target, days: [day(1), day(2), day(3)] });
    expect(await markDayLogged(db, "u1", 1)).toBe(true);
    expect(await markDayLogged(db, "u1", 1)).toBe(true); // already marked: no second push
    expect(mealPlan.update).toHaveBeenCalledTimes(1);
    expect(await markDayLogged(db, "u1", 3)).toBe(false);
    expect(await markDayLogged(db, "u1", -1)).toBe(false);
    expect(await markDayLogged(db, "u1", 1.5)).toBe(false);
    expect((await getMealPlan(db, "u1"))?.loggedDays).toEqual([1]);
  });

  it("a new plan replaces the old one and clears the logged marks", async () => {
    const { db } = fakeDb();
    await saveMealPlan(db, "u1", { startDate: "2026-10-07", target, days: [day(1), day(2)] });
    await markDayLogged(db, "u1", 0);
    await saveMealPlan(db, "u1", { startDate: "2026-10-08", target, days: [day(5)] });
    const plan = await getMealPlan(db, "u1");
    expect(plan?.startDate).toBe("2026-10-08");
    expect(plan?.loggedDays).toEqual([]);
  });

  it("clears the plan", async () => {
    const { db } = fakeDb();
    await saveMealPlan(db, "u1", { startDate: "2026-10-07", target, days: [day(1)] });
    await clearMealPlan(db, "u1");
    expect(await getMealPlan(db, "u1")).toBeNull();
    expect(await markDayLogged(db, "u1", 0)).toBe(false);
  });
});
