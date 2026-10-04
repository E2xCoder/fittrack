/**
 * Central palette for every tracked metric. Import these instead of hard-coding
 * hex values so charts, bars, chips and cards stay visually consistent.
 *
 * We expose raw hex (+ a translucent variant) and drive color through inline
 * `style` props. Tailwind v4 only emits utilities it can see as literal strings
 * in source, so runtime-built class names (`bg-[${hex}]`) would be purged —
 * inline styles are the reliable way to theme by metric dynamically.
 */

export type MetricKey =
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "steps"
  | "water"
  | "sleep";

export interface MetricStyle {
  hex: string;
  soft: string; // translucent fill for chart gradients / chip backgrounds
  label: string;
}

function make(hex: string, label: string): MetricStyle {
  return { hex, soft: `${hex}22`, label };
}

export const METRICS: Record<MetricKey, MetricStyle> = {
  calories: make("#f97316", "Calories"),
  protein: make("#3b82f6", "Protein"),
  carbs: make("#eab308", "Carbs"),
  fat: make("#a855f7", "Fat"),
  steps: make("#14b8a6", "Steps"),
  water: make("#06b6d4", "Water"),
  sleep: make("#6366f1", "Sleep"),
};

export const SEMANTIC = {
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  accent: "#16a34a",
  streakFrom: "#f97316",
  streakTo: "#ef4444",
};

/** Interpolate red → amber → green for a 0-100 score. */
export function scoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s < 50) return lerpColor("#ef4444", "#f59e0b", s / 50);
  return lerpColor("#f59e0b", "#22c55e", (s - 50) / 50);
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff,
    ag = (ah >> 8) & 0xff,
    ab = ah & 0xff;
  const br = (bh >> 16) & 0xff,
    bg = (bh >> 8) & 0xff,
    bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1)}`;
}

export function percent(current: number, target: number): number {
  if (!target) return 0;
  return Math.min((current / target) * 100, 100);
}
