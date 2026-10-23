import type { MealType } from "@/lib/meal-type";

export interface InsightInput {
  totals: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calories: number; protein: number; carbs: number; fat: number };
  /** Calories logged per meal type (only meals that were actually logged). */
  caloriesByMeal: Partial<Record<MealType, number>>;
  logCount: number;
  /** True when the viewed day is still in progress (affects pacing rules). */
  isToday: boolean;
  /** Local hour 0-23, used only when isToday. */
  hour: number;
}

export type InsightLevel = "good" | "warn" | "info";

export interface Insight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
}

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };
const pct = (v: number, of: number) => (of > 0 ? (v / of) * 100 : 0);
const r = (n: number) => Math.round(n);

// Only uses values FitTrack actually tracks — never invents micronutrients.
export function buildInsights(input: InsightInput): Insight[] {
  const { totals, goals, caloriesByMeal, logCount, isToday, hour } = input;
  if (logCount === 0) return [];

  const out: Insight[] = [];
  const calPct = pct(totals.calories, goals.calories);
  const proteinPct = pct(totals.protein, goals.protein);
  const carbsPct = pct(totals.carbs, goals.carbs);
  const fatPct = pct(totals.fat, goals.fat);
  // Day is "mostly done" when it's over, or evening, or most calories are in.
  const dayMostlyDone = !isToday || hour >= 18 || calPct >= 75;

  // Calories
  if (calPct > 110) {
    out.push({
      id: "cal-over",
      level: "warn",
      title: `${r(totals.calories - goals.calories)} kcal over your goal`,
      detail: "Occasional overshoots are fine; if it keeps happening, smaller portions or lighter snacks close the gap fastest.",
    });
  } else if (!isToday && calPct < 60) {
    out.push({
      id: "cal-under",
      level: "warn",
      title: `Only ${r(calPct)}% of your calorie goal`,
      detail: "Either meals are missing from the log or intake was very low. Logging everything keeps your averages honest.",
    });
  } else if (calPct >= 90 && calPct <= 110) {
    out.push({
      id: "cal-on",
      level: "good",
      title: "Calories right on target",
      detail: `${r(totals.calories)} of ${goals.calories} kcal.`,
    });
  }

  // Protein
  if (proteinPct >= 100) {
    out.push({
      id: "protein-good",
      level: "good",
      title: "Protein target hit",
      detail: `${r(totals.protein)}g of ${goals.protein}g — enough to support recovery and muscle.`,
    });
  } else if (dayMostlyDone && proteinPct < 70) {
    out.push({
      id: "protein-low",
      level: "warn",
      title: `Protein is low (${r(totals.protein)} / ${goals.protein}g)`,
      detail: `${r(goals.protein - totals.protein)}g to go. Lean meat, fish, eggs, Greek yogurt, legumes or a shake in the next meal would close it.`,
    });
  }

  // Carbs
  if (dayMostlyDone && carbsPct < 60) {
    out.push({
      id: "carbs-low",
      level: "info",
      title: `Carbs are on the low side (${r(totals.carbs)} / ${goals.carbs}g)`,
      detail: "Carbs fuel training and energy. If you're lifting today, add rice, oats, fruit or potatoes around your session.",
    });
  }

  // Fat
  if (fatPct > 115) {
    out.push({
      id: "fat-over",
      level: "warn",
      title: `Fat is above target (${r(totals.fat)} / ${goals.fat}g)`,
      detail: "Fat is the most calorie-dense macro (9 kcal/g). Oils, nuts, cheese and fried food add up quickly.",
    });
  }

  // Macro split of the calories actually eaten
  const macroKcal =
    totals.protein * KCAL_PER_G.protein + totals.carbs * KCAL_PER_G.carbs + totals.fat * KCAL_PER_G.fat;
  if (macroKcal > 300) {
    const fatShare = pct(totals.fat * KCAL_PER_G.fat, macroKcal);
    if (fatShare > 40 && fatPct <= 115) {
      out.push({
        id: "fat-share",
        level: "info",
        title: `${r(fatShare)}% of your calories come from fat`,
        detail: "A common guideline is 20–35%. Swapping some fat for carbs or protein would balance the day.",
      });
    }
  }

  // Meal distribution
  const mealCals = Object.values(caloriesByMeal).filter((v): v is number => typeof v === "number" && v > 0);
  const mealTotal = mealCals.reduce((a, b) => a + b, 0);
  if (mealCals.length >= 2 && mealTotal > 600) {
    const biggest = Math.max(...mealCals);
    if (pct(biggest, mealTotal) > 60) {
      out.push({
        id: "meal-skew",
        level: "info",
        title: `${r(pct(biggest, mealTotal))}% of your calories were in one meal`,
        detail: "Spreading intake across meals keeps energy and protein distribution steadier through the day.",
      });
    }
  }

  return out;
}
