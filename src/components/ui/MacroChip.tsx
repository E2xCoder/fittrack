import { METRICS, type MetricKey } from "@/lib/metrics";

/**
 * Colored macro chip, e.g. "P 31g" in blue. Used across meals, dashboard and
 * timelines so protein is always blue, carbs amber, fat purple, calories orange.
 */
const SHORT: Record<MetricKey, string> = {
  calories: "",
  protein: "P",
  carbs: "C",
  fat: "F",
  steps: "",
  water: "",
  sleep: "",
};

export function MacroChip({
  metric,
  value,
  unit = "g",
  size = "sm",
}: {
  metric: Extract<MetricKey, "protein" | "carbs" | "fat" | "calories">;
  value: number;
  unit?: string;
  size?: "sm" | "md";
}) {
  const { hex } = METRICS[metric];
  const prefix = SHORT[metric];
  const pad = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg font-semibold tabular-nums ${pad}`}
      style={{ backgroundColor: `${hex}1f`, color: hex }}
    >
      {prefix && <span className="opacity-70">{prefix}</span>}
      {Math.round(value)}
      {unit}
    </span>
  );
}

/** The three macro chips together, in the canonical order. */
export function MacroChipRow({
  protein,
  carbs,
  fat,
  size = "sm",
}: {
  protein: number;
  carbs: number;
  fat: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MacroChip metric="protein" value={protein} size={size} />
      <MacroChip metric="carbs" value={carbs} size={size} />
      <MacroChip metric="fat" value={fat} size={size} />
    </div>
  );
}
