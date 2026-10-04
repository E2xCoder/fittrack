"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { posthog } from "@/lib/posthog";
import { toDateString } from "@/lib/date";
import { MEAL_TYPE_OPTIONS } from "@/lib/meal-type";
import { METRICS } from "@/lib/metrics";
import { ProgressBar } from "@/components/ui/Progress";
import { macroDeviations, type Macros, type PlanDay } from "@/lib/meal-plan";

const STORAGE_KEY = "fittrack-meal-plan-v1";
const SLOT_META = Object.fromEntries(MEAL_TYPE_OPTIONS.map((o) => [o.value, o]));

interface StoredPlan {
  target: Macros;
  days: PlanDay[];
  startDate: string;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

export default function MealPlanPage() {
  const [dayCount, setDayCount] = useState<3 | 5 | 7>(7);
  const [includeSnack, setIncludeSnack] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [active, setActive] = useState(0);
  const [logging, setLogging] = useState<number | null>(null);
  const [logged, setLogged] = useState<Record<number, boolean>>({});

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setPlan(JSON.parse(raw) as StoredPlan);
      } catch {
        /* ignore corrupt storage */
      }
    });
  }, []);

  function persist(p: StoredPlan | null) {
    setPlan(p);
    try {
      if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: dayCount, includeSnack, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not generate a plan.");
        return;
      }
      persist({ target: data.target, days: data.days, startDate: toDateString(new Date()) });
      setActive(0);
      setLogged({});
      posthog.capture("meal_plan_generated", { days: data.days.length });
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function logDay(index: number) {
    if (!plan || logging !== null) return;
    setLogging(index);
    setError("");
    const date = addDays(plan.startDate, index);
    const jobs = plan.days[index].meals.flatMap((m) =>
      m.items.map((it) =>
        fetch("/api/log-meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mealId: it.mealId, quantity: it.quantity, mealType: m.slot, date }),
        }).then((r) => { if (!r.ok) throw new Error("log failed"); })
      )
    );
    const results = await Promise.allSettled(jobs);
    if (results.some((r) => r.status === "rejected")) {
      setError("Some items couldn't be logged (a meal may have been deleted). Check the day before retrying.");
    } else {
      setLogged((p) => ({ ...p, [index]: true }));
      posthog.capture("meal_plan_day_logged");
    }
    setLogging(null);
  }

  const day = plan?.days[active];
  const dateLabel = (i: number) =>
    plan
      ? new Date(`${addDays(plan.startDate, i)}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
      : "";

  return (
    <main className="mx-auto max-w-2xl p-4 pb-28">
      <div className="mb-5">
        <Link href="/meals" className="text-xs text-zinc-500 hover:text-zinc-300">← Meals</Link>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-green-400/80">Planner</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Meal plan</h1>
        <p className="text-xs text-zinc-500">Built from your own meal library and daily targets — all numbers come from your saved meals.</p>
      </div>

      {/* Generator */}
      <div className="mb-5 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-zinc-300">Days</p>
          <div className="flex gap-1.5">
            {([3, 5, 7] as const).map((n) => (
              <button
                key={n}
                onClick={() => setDayCount(n)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  dayCount === n ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {n} days
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-zinc-800/60 px-3 py-2.5">
          <span className="text-sm text-zinc-300">Include a daily snack</span>
          <input type="checkbox" checked={includeSnack} onChange={(e) => setIncludeSnack(e.target.checked)} className="h-4 w-4 accent-green-600" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-300">Anything to avoid or prefer? (optional)</span>
          <input
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. no fish, more chicken"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-600"
          />
        </label>
        <button
          onClick={generate}
          disabled={loading}
          className="w-full rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
        >
          {loading ? "Planning your week…" : plan ? "✨ Generate a new plan" : "✨ Generate plan"}
        </button>
        {error && <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Plan */}
      {plan && day && (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {plan.days.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-center transition-colors ${
                  active === i ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                <span className="block text-[10px] font-semibold uppercase">D{i + 1}</span>
                <span className="block text-[11px]">{dateLabel(i)}</span>
              </button>
            ))}
          </div>

          <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-3xl font-black tabular-nums text-white">
                {Math.round(day.totals.calories)}
                <span className="ml-1 text-sm font-medium text-zinc-500">/ {plan.target.calories} kcal</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { label: "Protein", metric: "protein", v: day.totals.protein, t: plan.target.protein },
                  { label: "Carbs", metric: "carbs", v: day.totals.carbs, t: plan.target.carbs },
                  { label: "Fat", metric: "fat", v: day.totals.fat, t: plan.target.fat },
                ] as const
              ).map((m) => (
                <div key={m.metric}>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">{m.label}</p>
                  <p className="mb-1 text-sm font-bold tabular-nums text-white">
                    {Math.round(m.v)}
                    <span className="text-[11px] font-medium text-zinc-500"> / {m.t}g</span>
                  </p>
                  <ProgressBar value={m.v} target={m.t} color={METRICS[m.metric].hex} height={6} />
                </div>
              ))}
            </div>
            {macroDeviations(day.totals, plan.target).map((w) => (
              <p key={w} className="mt-3 rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
                ⚠️ {w}. Generate a new plan for a better balance.
              </p>
            ))}
          </div>

          <div className="space-y-3">
            {day.meals.map((m, mi) => {
              const meta = SLOT_META[m.slot];
              const kcal = m.items.reduce((s, it) => s + it.calories, 0);
              return (
                <div key={mi} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      <span aria-hidden className="mr-1.5">{meta?.icon}</span>
                      {meta?.label ?? m.slot}
                    </p>
                    <p className="text-sm font-semibold tabular-nums" style={{ color: METRICS.calories.hex }}>
                      {Math.round(kcal)} kcal
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {m.items.map((it, ii) => (
                      <div key={ii} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-zinc-200">{it.name}</span>
                        <span className="shrink-0 text-xs text-zinc-500">{it.amountLabel}</span>
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-zinc-400">{Math.round(it.calories)} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => logDay(active)}
            disabled={logging !== null || logged[active]}
            className="mt-4 w-full rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {logged[active]
              ? `✓ Logged to ${dateLabel(active)}`
              : logging === active
                ? "Logging…"
                : `Log this day to ${dateLabel(active)}`}
          </button>
          <button
            onClick={() => persist(null)}
            className="mt-2 w-full rounded-2xl py-2.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear plan
          </button>
        </>
      )}
    </main>
  );
}
