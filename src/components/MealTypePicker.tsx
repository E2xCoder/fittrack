"use client";

import { MEAL_TYPE_OPTIONS, type MealType } from "@/lib/meal-type";

export default function MealTypePicker({
  value,
  onChange,
  compact = false,
}: {
  value: MealType;
  onChange: (v: MealType) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {MEAL_TYPE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex flex-1 flex-col items-center rounded-xl transition-colors ${compact ? "gap-0 py-1.5" : "gap-0.5 py-2.5"} ${
            value === o.value ? "bg-green-600 text-white" : "bg-zinc-700/50 text-zinc-400 hover:text-white"
          }`}
        >
          <span className={compact ? "text-sm" : "text-lg"} aria-hidden>{o.icon}</span>
          <span className="text-[10px] font-semibold">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
