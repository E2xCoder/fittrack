"use client";

import { useEffect, useState } from "react";

interface DayData {
  date: string;
  label: string;
  calories: number;
  protein: number;
  steps: number;
  caloriesBurned: number;
  netCalories: number;
  deficit: number;
  proteinHit: boolean;
  logged: boolean;
  isGymDay: boolean;
  gymSplit: string | null;
}

interface Summary {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  deficitDays: number;
  surplusDays: number;
  proteinHitDays: number;
  gymDays: number;
  loggedDays: number;
}

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AnalyticsData {
  goals: Goals;
  days: DayData[];
  summary: Summary;
  verdicts: string[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <main className="p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      </main>
    );
  }

  if (!data) return <main className="p-6 text-zinc-400">Failed to load</main>;

  const { summary, days, verdicts, goals } = data;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Weekly Analytics</h1>
        <p className="text-sm text-zinc-400">Last 7 days · {summary.loggedDays} days logged</p>
      </div>

      {/* Weekly verdict */}
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Weekly Summary</h2>
        <div className="space-y-2">
          {verdicts.map((v, i) => (
            <p key={i} className="text-sm text-zinc-300">{v}</p>
          ))}
        </div>
      </div>

      {/* Averages */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { label: "Avg Calories", value: summary.avgCalories, target: goals.calories, unit: "kcal", color: "text-green-400" },
          { label: "Avg Protein", value: summary.avgProtein, target: goals.protein, unit: "g", color: "text-blue-400" },
          { label: "Avg Carbs", value: summary.avgCarbs, target: goals.carbs, unit: "g", color: "text-amber-400" },
          { label: "Avg Fat", value: summary.avgFat, target: goals.fat, unit: "g", color: "text-rose-400" },
        ].map(({ label, value, target, unit, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-1 text-xs text-zinc-500">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>
              {value}<span className="ml-1 text-sm text-zinc-500">{unit}</span>
            </p>
            <p className="text-xs text-zinc-600">target: {target}{unit}</p>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{summary.deficitDays}</p>
          <p className="text-xs text-zinc-500">Deficit days</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{summary.proteinHitDays}</p>
          <p className="text-xs text-zinc-500">Protein hit</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{summary.gymDays}</p>
          <p className="text-xs text-zinc-500">Gym sessions</p>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-4 font-semibold">Daily Breakdown</h2>
        <div className="space-y-3">
          {days.map((day) => (
            <div
              key={day.date}
              className={`rounded-xl p-3 ${
                day.isGymDay ? "bg-zinc-800 ring-1 ring-green-800"
                : day.logged ? "bg-zinc-800"
                : "bg-zinc-800/40"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{day.label}</span>
                  {day.isGymDay && day.gymSplit && (
                    <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">
                      🏋️ {day.gymSplit}
                    </span>
                  )}
                  {day.isGymDay && !day.gymSplit && (
                    <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300">
                      🏋️ Gym
                    </span>
                  )}
                </div>
                {!day.logged && !day.isGymDay ? (
                  <span className="text-xs text-zinc-600">Not logged</span>
                ) : day.logged ? (
                  <div className="flex gap-2">
                    <span className={`text-xs ${day.proteinHit ? "text-blue-400" : "text-zinc-500"}`}>
                      {day.proteinHit ? "✓ P" : "✗ P"}
                    </span>
                    <span className={`text-xs font-medium ${day.deficit > 0 ? "text-green-400" : "text-rose-400"}`}>
                      {day.deficit > 0
                        ? `−${Math.round(day.deficit)} deficit`
                        : `+${Math.round(Math.abs(day.deficit))} surplus`}
                    </span>
                  </div>
                ) : null}
              </div>

              {day.logged && (
                <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                  <span>{Math.round(day.calories)} kcal eaten</span>
                  {day.caloriesBurned > 0 && (
                    <span className="text-orange-400">−{day.caloriesBurned} burned</span>
                  )}
                  {day.caloriesBurned > 0 && (
                    <span className="text-zinc-300">= {Math.round(day.netCalories)} net</span>
                  )}
                  <span>P: {Math.round(day.protein)}g</span>
                  {day.steps > 0 && (
                    <span className="text-purple-400">👟 {day.steps.toLocaleString()}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}