import { describe, expect, it } from "vitest";
import { assemblePlan, isPlannable, macroDeviations, type LibraryMeal } from "./meal-plan";

const lib: LibraryMeal[] = [
  { id: "oats", name: "Oats", calories: 300, protein: 10, carbs: 50, fat: 6, servingSize: 80, servingLabel: "g" },
  { id: "egg", name: "Egg", calories: 70, protein: 6, carbs: 0.5, fat: 5, servingSize: 1, servingLabel: "piece" },
  { id: "rice", name: "Rice bowl", calories: 500, protein: 25, carbs: 80, fat: 8, servingSize: 1, servingLabel: "piece" },
];
const target = { calories: 1000, protein: 80, carbs: 120, fat: 30 };

describe("assemblePlan", () => {
  it("drops unknown ids and computes numbers from the library, not the model", () => {
    const days = assemblePlan(
      { days: [{ meals: [{ slot: "breakfast", items: [{ mealId: "oats", quantity: 1, calories: 9999 }, { mealId: "ghost", quantity: 2 }] }, { slot: "lunch", items: [{ mealId: "rice", quantity: 1 }] }] }] },
      lib, target, 7
    );
    expect(days).toHaveLength(1);
    expect(days[0].meals[0].items).toHaveLength(1); // ghost dropped
    // 300 + 500 = 800 -> 20% under target -> scaled up toward 1000
    expect(days[0].totals.calories).toBeGreaterThan(800);
  });

  it("clamps pieces to whole numbers up to 6", () => {
    const [day] = assemblePlan(
      { days: [{ meals: [{ slot: "lunch", items: [{ mealId: "egg", quantity: 99 }] }] }] },
      lib, { calories: 420, protein: 36, carbs: 3, fat: 30 }, 7
    );
    expect(day.meals[0].items[0].quantity).toBe(6);
    expect(day.meals[0].items[0].amountLabel).toBe("6 pc");
  });

  it("never rounds a piece item to a fraction", () => {
    const [day] = assemblePlan(
      { days: [{ meals: [{ slot: "breakfast", items: [{ mealId: "egg", quantity: 0.25 }] }] }] },
      lib, { calories: 70, protein: 6, carbs: 0.5, fat: 5 }, 7
    );
    expect(day.meals[0].items[0].quantity).toBe(1);
  });

  it("filters out macro-helper entries like a 1g Protein quick-add", () => {
    const helper: LibraryMeal = { id: "p", name: "Protein", calories: 0, protein: 1, carbs: 0, fat: 0, servingSize: 1, servingLabel: "g" };
    expect(isPlannable(helper)).toBe(false);
    expect(isPlannable(lib[0])).toBe(true);
  });

  it("leaves a day alone when already within 8% of the target", () => {
    const [day] = assemblePlan(
      { days: [{ meals: [{ slot: "dinner", items: [{ mealId: "rice", quantity: 2 }] }] }] },
      lib, target, 7
    );
    expect(day.meals[0].items[0].quantity).toBe(2);
    expect(day.totals.calories).toBe(1000);
  });

  it("labels gram servings by amount and respects maxDays", () => {
    const days = assemblePlan(
      { days: [{ meals: [{ slot: "breakfast", items: [{ mealId: "oats", quantity: 1.5 }] }] }, { meals: [{ slot: "breakfast", items: [{ mealId: "oats", quantity: 1 }] }] }] },
      lib, { calories: 450, protein: 15, carbs: 75, fat: 9 }, 1
    );
    expect(days).toHaveLength(1);
    expect(days[0].meals[0].items[0].amountLabel).toBe("120g");
  });

  it("returns nothing for garbage input", () => {
    expect(assemblePlan(null, lib, target, 7)).toEqual([]);
    expect(assemblePlan({ days: [{ meals: [{ slot: "x", items: [] }] }] }, lib, target, 7)).toEqual([]);
  });
});

describe("macroDeviations", () => {
  it("flags macros more than 30% off and ignores close ones", () => {
    const w = macroDeviations({ calories: 1957, protein: 141, carbs: 305, fat: 37 }, { calories: 2050, protein: 138, carbs: 190, fat: 70 });
    expect(w).toEqual(["Carbs is 61% over target", "Fat is 47% under target"]);
    expect(macroDeviations({ calories: 2000, protein: 140, carbs: 190, fat: 70 }, { calories: 2050, protein: 138, carbs: 190, fat: 70 })).toEqual([]);
  });
});
