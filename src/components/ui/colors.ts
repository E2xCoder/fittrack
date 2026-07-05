/** Semantic metric colors — single source of truth for charts and inline styles.
 *  Tailwind utilities (bg-cal, text-protein, …) come from the @theme block in
 *  globals.css; use these constants when a raw hex value is needed (recharts,
 *  SVG strokes, inline gradients). */
export const metricColors = {
  calories: "#f97316",
  protein: "#3b82f6",
  carbs: "#eab308",
  fat: "#a855f7",
  steps: "#14b8a6",
  water: "#06b6d4",
  sleep: "#6366f1",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  accent: "#16a34a",
} as const;

export type MetricColor = keyof typeof metricColors;

/** Score gradient: red → amber → green as the daily score climbs. */
export function scoreColor(score: number): string {
  if (score >= 80) return metricColors.success;
  if (score >= 55) return "#84cc16";
  if (score >= 35) return metricColors.warning;
  if (score > 0) return metricColors.calories;
  return "#52525b";
}
