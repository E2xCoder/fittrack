import { describe, expect, it } from "vitest";
import { buildFoodHistory, type HistoryLogInput } from "./food-history";

const snap = (name: string, over: Partial<NonNullable<HistoryLogInput["mealSnapshot"]>> = {}) => ({
  name,
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 5,
  servingSize: 100,
  servingLabel: "g",
  ...over,
});

describe("buildFoodHistory", () => {
  it("keeps the most recent log of each food and counts repeats", () => {
    const items = buildFoodHistory([
      { quantity: 1.5, createdAt: "2026-10-03T10:00:00Z", mealSnapshot: snap("Oats") },
      { quantity: 1, createdAt: "2026-10-02T10:00:00Z", mealSnapshot: snap("oats ") },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].lastAmount).toBe(150);
    expect(items[0].count).toBe(2);
    expect(items[0].perUnit.calories).toBeCloseTo(2);
  });

  it("converts library pieces to per-piece values", () => {
    const [egg] = buildFoodHistory([
      {
        quantity: 3,
        createdAt: "2026-10-03T08:00:00Z",
        meal: {
          id: "m1", name: "Egg", calories: 78, protein: 6, carbs: 0.6, fat: 5,
          servingSize: 1, servingLabel: "piece", imageUrl: null,
        },
      },
    ]);
    expect(egg.unit).toBe("piece");
    expect(egg.lastAmount).toBe(3);
    expect(egg.perUnit.calories).toBe(78);
  });

  it("treats the same name in different units as different foods", () => {
    const items = buildFoodHistory([
      { quantity: 1, createdAt: "2026-10-03T10:00:00Z", mealSnapshot: snap("Milk", { servingLabel: "ml" }) },
      { quantity: 1, createdAt: "2026-10-02T10:00:00Z", mealSnapshot: snap("Milk") },
    ]);
    expect(items.map((i) => i.unit)).toEqual(["ml", "g"]);
  });

  it("skips nameless and empty rows, and respects the limit", () => {
    const items = buildFoodHistory(
      [
        { quantity: 1, createdAt: "2026-10-03T10:00:00Z", mealSnapshot: { calories: 100 } },
        { quantity: 1, createdAt: "2026-10-03T10:00:00Z", mealSnapshot: snap("Zero", { calories: 0, protein: 0, carbs: 0, fat: 0 }) },
        { quantity: 1, createdAt: "2026-10-03T09:00:00Z", mealSnapshot: snap("A") },
        { quantity: 1, createdAt: "2026-10-03T08:00:00Z", mealSnapshot: snap("B") },
      ],
      1
    );
    expect(items.map((i) => i.name)).toEqual(["A"]);
  });
});
