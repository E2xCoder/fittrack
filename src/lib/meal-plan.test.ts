import { describe, expect, it } from "vitest";
import { assemblePlan, type LibraryMeal } from "./meal-plan";

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

  it("clamps quantities to 0.25 steps within 0.25-5", () => {
    const [day] = assemblePlan(
      { days: [{ meals: [{ slot: "lunch", items: [{ mealId: "egg", quantity: 99 }] }] }] },
      lib, { calories: 350, protein: 30, carbs: 3, fat: 25 }, 7
    );
    expect(day.meals[0].items[0].quantity).toBe(5);
    expect(day.meals[0].items[0].amountLabel).toBe("5 pc");
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
