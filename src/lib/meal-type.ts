export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_OPTIONS: { value: MealType; label: string; icon: string }[] = [
  { value: "breakfast", label: "Breakfast", icon: "🌅" },
  { value: "lunch", label: "Lunch", icon: "☀️" },
  { value: "dinner", label: "Dinner", icon: "🌙" },
  { value: "snack", label: "Snack", icon: "🍎" },
];

// Preselect the meal that matches the current time so most logs need no extra tap.
export function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 22) return "dinner";
  return "snack";
}

export function parseMealType(value: unknown): MealType | null {
  return MEAL_TYPES.includes(value as MealType) ? (value as MealType) : null;
}
