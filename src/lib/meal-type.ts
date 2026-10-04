export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_OPTIONS: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "Breakfast", icon: "🌅" },
  { value: "lunch", label: "Lunch", icon: "☀️" },
  { value: "dinner", label: "Dinner", icon: "🌙" },
  { value: "snack", label: "Snack", icon: "🍎" },
];

function mealTypeForHour(h: number): MealType {
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 22) return "dinner";
  return "snack";
}

// Preselect the meal that matches the current time so most logs need no extra tap.
export function defaultMealType(): MealType {
  return mealTypeForHour(new Date().getHours());
}

// Which meal a logged entry belongs to: the type chosen when logging, or —
// for older entries without one — the time it was logged.
export function mealTypeForLog(log: { mealType?: string | null; createdAt?: string }): MealType {
  const stored = parseMealType(log.mealType);
  if (stored) return stored;
  if (!log.createdAt) return "snack";
  return mealTypeForHour(new Date(log.createdAt).getHours());
}

export function parseMealType(value: unknown): MealType | null {
  return MEAL_TYPES.includes(value as MealType) ? (value as MealType) : null;
}
