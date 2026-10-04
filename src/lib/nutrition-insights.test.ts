import { describe, expect, it } from "vitest";
import { buildInsights, type InsightInput } from "./nutrition-insights";

const base: InsightInput = {
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  goals: { calories: 2000, protein: 140, carbs: 220, fat: 70 },
  caloriesByMeal: {},
  logCount: 1,
  isToday: false,
  hour: 12,
};
const ids = (i: InsightInput) => buildInsights(i).map((x) => x.id);

describe("buildInsights", () => {
  it("returns nothing when nothing is logged", () => {
    expect(buildInsights({ ...base, logCount: 0 })).toEqual([]);
  });

  it("praises hitting calories and protein", () => {
    const out = ids({ ...base, totals: { calories: 2000, protein: 145, carbs: 220, fat: 70 } });
    expect(out).toContain("cal-on");
    expect(out).toContain("protein-good");
  });

  it("flags low protein only once the day is mostly done", () => {
    const early = { ...base, isToday: true, hour: 10, totals: { calories: 300, protein: 20, carbs: 40, fat: 10 } };
    expect(ids(early)).not.toContain("protein-low");
    const late = { ...early, hour: 20 };
    expect(ids(late)).toContain("protein-low");
  });

  it("flags a calorie overshoot with the amount", () => {
    const out = buildInsights({ ...base, totals: { calories: 2400, protein: 140, carbs: 220, fat: 70 } });
    const over = out.find((x) => x.id === "cal-over");
    expect(over?.title).toContain("400 kcal");
  });

  it("flags very low intake on a finished day", () => {
    expect(ids({ ...base, totals: { calories: 900, protein: 60, carbs: 100, fat: 30 } })).toContain("cal-under");
  });

  it("flags a high fat share of calories", () => {
    // 100g fat = 900 kcal of 1300 from macros -> ~69% from fat
    const out = ids({ ...base, goals: { ...base.goals, fat: 200 }, totals: { calories: 1300, protein: 40, carbs: 50, fat: 100 } });
    expect(out).toContain("fat-share");
  });

  it("flags calories concentrated in one meal", () => {
    const out = ids({
      ...base,
      totals: { calories: 1800, protein: 120, carbs: 200, fat: 60 },
      caloriesByMeal: { dinner: 1400, breakfast: 400 },
    });
    expect(out).toContain("meal-skew");
  });

  it("does not flag meal skew for a single logged meal", () => {
    const out = ids({ ...base, totals: { calories: 800, protein: 60, carbs: 90, fat: 30 }, caloriesByMeal: { lunch: 800 } });
    expect(out).not.toContain("meal-skew");
  });
});
