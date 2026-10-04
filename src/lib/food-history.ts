// Turns a user's most recent meal logs into a de-duplicated "recent foods" list.
// Pure (no DB access) so the grouping rules can be unit-tested.

export interface HistoryLogInput {
  quantity: number;
  mealType?: string | null;
  createdAt: Date | string;
  meal?: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: number;
    servingLabel: string;
    imageUrl: string | null;
  } | null;
  mealSnapshot?: {
    name?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    servingSize?: number;
    servingLabel?: string;
    imageUrl?: string | null;
  } | null;
}

export interface HistoryItem {
  key: string;
  name: string;
  /** Macros for ONE unit (1 g / 1 ml / 1 piece). */
  perUnit: { calories: number; protein: number; carbs: number; fat: number };
  unit: "g" | "ml" | "piece";
  /** Amount of the last log, in `unit`s. */
  lastAmount: number;
  imageUrl: string | null;
  lastLoggedAt: string;
  count: number;
}

function toUnit(label: string | undefined): "g" | "ml" | "piece" {
  return label === "g" || label === "ml" ? label : "piece";
}

export function buildFoodHistory(logs: HistoryLogInput[], limit = 25): HistoryItem[] {
  const byKey = new Map<string, HistoryItem>();

  // Logs arrive newest first; the first time a food is seen is its last use.
  for (const log of logs) {
    const src = log.meal ?? log.mealSnapshot;
    const name = (src?.name ?? "").trim();
    if (!name) continue;

    const unit = toUnit(src?.servingLabel);
    const servingSize = Number(src?.servingSize) > 0 ? Number(src?.servingSize) : unit === "piece" ? 1 : 100;
    const key = `${name.toLowerCase()}|${unit}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    const calories = Number(src?.calories) || 0;
    const protein = Number(src?.protein) || 0;
    const carbs = Number(src?.carbs) || 0;
    const fat = Number(src?.fat) || 0;
    const amount = log.quantity * servingSize;
    // Zero-calorie, zero-amount rows are junk (e.g. a failed import) — not worth suggesting.
    if (!(amount > 0) || (calories === 0 && protein === 0 && carbs === 0 && fat === 0)) continue;

    byKey.set(key, {
      key,
      name,
      perUnit: {
        calories: calories / servingSize,
        protein: protein / servingSize,
        carbs: carbs / servingSize,
        fat: fat / servingSize,
      },
      unit,
      lastAmount: Math.round(amount * 100) / 100,
      imageUrl: log.meal?.imageUrl ?? log.mealSnapshot?.imageUrl ?? null,
      lastLoggedAt: new Date(log.createdAt).toISOString(),
      count: 1,
    });
  }

  return [...byKey.values()].slice(0, limit);
}
