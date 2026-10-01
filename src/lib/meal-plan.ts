import { parseMealType, type MealType } from "./meal-type";

export interface LibraryMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingLabel: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PlanItem extends Macros {
  mealId: string;
  name: string;
  quantity: number;
  amountLabel: string;
}

export interface PlanMeal {
  slot: MealType;
  items: PlanItem[];
}

export interface PlanDay {
  meals: PlanMeal[];
  totals: Macros;
}

const STEP = 0.25;
const roundStep = (n: number) => Math.round(n / STEP) * STEP;
const clampQty = (q: number) => Math.min(5, Math.max(STEP, roundStep(q)));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function amountLabel(m: LibraryMeal, quantity: number): string {
  if (m.servingLabel === "piece") return `${quantity} pc`;
  return `${Math.round(quantity * m.servingSize)}${m.servingLabel}`;
}

function toItem(m: LibraryMeal, quantity: number): PlanItem {
  return {
    mealId: m.id,
    name: m.name,
    quantity,
    amountLabel: amountLabel(m, quantity),
    calories: m.calories * quantity,
    protein: m.protein * quantity,
    carbs: m.carbs * quantity,
    fat: m.fat * quantity,
  };
}

export function sumItems(items: PlanItem[]): Macros {
  return items.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function finishDay(meals: { slot: MealType; picks: { meal: LibraryMeal; quantity: number }[] }[]): PlanDay {
  const built: PlanMeal[] = meals.map((m) => ({ slot: m.slot, items: m.picks.map((p) => toItem(p.meal, p.quantity)) }));
  return { meals: built, totals: sumItems(built.flatMap((m) => m.items)) };
}

// Turns the model's picks (ids + quantities only) into a plan whose numbers
// all come from the user's own library. Unknown ids are dropped, quantities
// are clamped, and a day that misses the calorie target by >8% is scaled once.
export function assemblePlan(raw: unknown, library: LibraryMeal[], target: Macros, maxDays: number): PlanDay[] {
  const byId = new Map(library.map((m) => [m.id, m]));
  const rawDays = raw && typeof raw === "object" && Array.isArray((raw as { days?: unknown }).days)
    ? ((raw as { days: unknown[] }).days)
    : [];

  const days: PlanDay[] = [];
  for (const rawDay of rawDays.slice(0, maxDays)) {
    const rawMeals = rawDay && typeof rawDay === "object" && Array.isArray((rawDay as { meals?: unknown }).meals)
      ? (rawDay as { meals: unknown[] }).meals
      : [];

    const meals: { slot: MealType; picks: { meal: LibraryMeal; quantity: number }[] }[] = [];
    for (const rawMeal of rawMeals) {
      const rm = (rawMeal ?? {}) as { slot?: unknown; items?: unknown };
      const slot = parseMealType(rm.slot) ?? "snack";
      const picks: { meal: LibraryMeal; quantity: number }[] = [];
      for (const rawItem of Array.isArray(rm.items) ? rm.items : []) {
        const ri = (rawItem ?? {}) as { mealId?: unknown; quantity?: unknown };
        const meal = typeof ri.mealId === "string" ? byId.get(ri.mealId) : undefined;
        if (!meal) continue;
        const q = Number(ri.quantity);
        picks.push({ meal, quantity: clampQty(Number.isFinite(q) && q > 0 ? q : 1) });
      }
      if (picks.length) meals.push({ slot, picks });
    }
    if (!meals.length) continue;

    let day = finishDay(meals);
    if (day.totals.calories > 0 && target.calories > 0) {
      const ratio = target.calories / day.totals.calories;
      if (Math.abs(ratio - 1) > 0.08) {
        const scale = clamp(ratio, 0.5, 1.6);
        day = finishDay(
          meals.map((m) => ({
            slot: m.slot,
            picks: m.picks.map((p) => ({ meal: p.meal, quantity: clampQty(p.quantity * scale) })),
          }))
        );
      }
    }
    days.push(day);
  }
  return days;
}
