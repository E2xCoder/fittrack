"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MealLog {
  id: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal: {
    id: string;
    name: string;
    servingLabel: string;
    servingSize: number;
  };
}

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface DashboardData {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealLogs: MealLog[];
  goals: Goals;
}

function toDateString(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function MacroBar({ label, current, target, unit, color }: {
  label: string; current: number; target: number; unit: string; color: string;
}) {
  const pct = Math.min((current / target) * 100, 100);
  const remaining = Math.max(target - current, 0);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <span className="text-xs text-zinc-500">{Math.round(remaining)}{unit} left</span>
      </div>
      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{Math.round(current)}</span>
        <span className="text-sm text-zinc-500">/ {target}{unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatQuantity(log: MealLog): string {
  const label = log.meal.servingLabel;
  if (label === "piece") return `x${log.quantity}`;
  return `${Math.round(log.quantity * log.meal.servingSize)}${label}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [adjusting, setAdjusting] = useState<Record<string, boolean>>({});

  async function fetchData(date: string) {
    setLoading(true);
    const res = await fetch(`/api/dashboard?date=${date}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => { fetchData(selectedDate); }, [selectedDate]);

  async function removeMeal(id: string) {
    await fetch(`/api/log-meal/${id}`, { method: "DELETE" });
    fetchData(selectedDate);
  }

  async function adjustMeal(log: MealLog, delta: number) {
    const label = log.meal.servingLabel;
    const deltaQuantity = label === "piece" ? delta : delta / log.meal.servingSize;
    const newQuantity = log.quantity + deltaQuantity;

    if (newQuantity <= 0) {
      await removeMeal(log.id);
      return;
    }

    setAdjusting((p) => ({ ...p, [log.id]: true }));

    await fetch(`/api/log-meal/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity }),
    });

    setAdjusting((p) => ({ ...p, [log.id]: false }));
    fetchData(selectedDate);
  }

  function changeDate(offset: number) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(toDateString(d));
  }

  const todayStr = toDateString(new Date());
  const isToday = selectedDate === todayStr;

  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
          ← Prev
        </button>
        <div className="text-center">
          <p className="text-sm text-zinc-400">{displayDate}</p>
          {isToday && <span className="text-xs font-medium text-green-400">Today</span>}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-30">
          Next →
        </button>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <MacroBar label="Calories" current={data.totalCalories} target={data.goals.calories} unit="kcal" color="bg-green-500" />
            <MacroBar label="Protein" current={data.totalProtein} target={data.goals.protein} unit="g" color="bg-blue-500" />
            <MacroBar label="Carbs" current={data.totalCarbs} target={data.goals.carbs} unit="g" color="bg-amber-500" />
            <MacroBar label="Fat" current={data.totalFat} target={data.goals.fat} unit="g" color="bg-rose-500" />
          </div>

          <Link
            href={`/meals?date=${selectedDate}`}
            className="mb-6 flex w-full items-center justify-center rounded-2xl border border-dashed border-zinc-700 py-4 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            + Add meal {!isToday && `to ${displayDate}`}
          </Link>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">
                {isToday ? "Today's Meals" : `Meals — ${displayDate}`}
              </h2>
              <span className="text-xs text-zinc-500">{data.mealLogs.length} logged</span>
            </div>

            {data.mealLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">No meals logged</p>
            ) : (
              <div className="space-y-3">
                {data.mealLogs.map((log) => {
                  const isPiece = log.meal.servingLabel === "piece";
                  const step = isPiece ? 1 : 0.5;
                  return (
                    <div key={log.id} className="rounded-xl bg-zinc-800 p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="font-medium">{log.meal.name}</p>
                          <p className="text-xs text-zinc-400">
                            {Math.round(log.calories)} kcal · P:{Math.round(log.protein)}g ·
                            C:{Math.round(log.carbs)}g · F:{Math.round(log.fat)}g
                          </p>
                        </div>
                        <button
                          onClick={() => removeMeal(log.id)}
                          className="ml-3 rounded-lg bg-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900 hover:text-red-300"
                        >✕</button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustMeal(log, -step)}
                          disabled={adjusting[log.id]}
                          className="rounded-lg bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600 disabled:opacity-50"
                        >−</button>
                        <span className="min-w-16 text-center text-sm font-medium">
                          {formatQuantity(log)}
                        </span>
                        <button
                          onClick={() => adjustMeal(log, step)}
                          disabled={adjusting[log.id]}
                          className="rounded-lg bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600 disabled:opacity-50"
                        >+</button>
                        <span className="text-xs text-zinc-500">
                          {isPiece ? "pieces" : log.meal.servingLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}