"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { posthog } from "@/lib/posthog";
import { toDateString } from "@/lib/date";
import { MEAL_TYPE_OPTIONS, MEAL_TYPES, type MealType } from "@/lib/meal-type";
import { METRICS } from "@/lib/metrics";
import { ProgressBar } from "@/components/ui/Progress";
import { macroDeviations, sumItems, type Macros, type PlanDay, type PlanItem, type PlanMeal } from "@/lib/meal-plan";

const SLOT_META = Object.fromEntries(MEAL_TYPE_OPTIONS.map((o) => [o.value, o]));

interface StoredPlan {
  target: Macros;
  days: PlanDay[];
  startDate: string;
  loggedDays: number[];
}

interface LibraryRow {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingLabel: string;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

// ── Editing helpers (the server rebuilds every number; these only keep the screen in step) ──

const isPiece = (it: PlanItem) => it.amountLabel.endsWith(" pc");
const qtyRange = (it: PlanItem) => (isPiece(it) ? { step: 1, min: 1, max: 6 } : { step: 0.25, min: 0.25, max: 5 });

function scaledItem(it: PlanItem, quantity: number): PlanItem {
  const ratio = quantity / it.quantity;
  const m = it.amountLabel.match(/^(\d+(?:\.\d+)?)(.*)$/);
  return {
    ...it,
    quantity,
    amountLabel: isPiece(it) ? `${quantity} pc` : m ? `${Math.round(Number(m[1]) * ratio)}${m[2]}` : it.amountLabel,
    calories: it.calories * ratio,
    protein: it.protein * ratio,
    carbs: it.carbs * ratio,
    fat: it.fat * ratio,
  };
}

function itemFromLibrary(m: LibraryRow): PlanItem {
  return {
    mealId: m.id,
    name: m.name,
    quantity: 1,
    amountLabel: m.servingLabel === "piece" ? "1 pc" : `${Math.round(m.servingSize)}${m.servingLabel}`,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
  };
}

const rawMeals = (meals: PlanMeal[]) =>
  meals.map((m) => ({ slot: m.slot, items: m.items.map((i) => ({ mealId: i.mealId, quantity: i.quantity })) }));

// ── "Add food" sheet ──

function AddFoodSheet({ slot, onPick, onClose }: { slot: MealType; onPick: (m: LibraryRow) => void; onClose: () => void }) {
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meals/all")
      .then((r) => (r.ok ? r.json() : { meals: [] }))
      .then((d) => { if (!cancelled) setRows(d.meals ?? []); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  const shown = (rows ?? []).filter((r) => r.calories > 0 && r.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Add to {SLOT_META[slot]?.label ?? slot}</p>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your meals…"
          className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-600"
        />
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {rows === null && <p className="py-6 text-center text-sm text-zinc-500">Loading…</p>}
          {rows !== null && shown.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No matching meals in your library.</p>}
          {shown.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-zinc-800/60 px-3 py-2.5 text-left hover:bg-zinc-800"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{r.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">
                {Math.round(r.calories)} kcal · {r.servingLabel === "piece" ? "1 pc" : `${Math.round(r.servingSize)}${r.servingLabel}`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
  const [restoring, setRestoring] = useState(true);
  const [adding, setAdding] = useState<MealType | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const logged = new Set(plan?.loggedDays ?? []);

  // Edits are applied on screen at once and sent to the server shortly after.
  // `version` lets a late reply be ignored when a newer edit has happened since.
  const versionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ index: number; meals: PlanMeal[]; version: number } | null>(null);

  // The plan is saved on the server (it follows you across devices).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/meal-plan/current")
      .then((r) => (r.ok ? r.json() : { plan: null }))
      .then((d) => { if (!cancelled) setPlan(d.plan ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, []);

  async function pushDay(index: number, meals: PlanMeal[], version: number, keepalive = false) {
    pendingRef.current = null;
    setSaveState("saving");
    const res = await fetch("/api/meal-plan/current", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive,
      body: JSON.stringify({ dayIndex: index, meals: rawMeals(meals) }),
    }).catch(() => null);
    if (version !== versionRef.current) return; // a newer edit owns the screen now
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "Couldn't save your changes.");
      setSaveState("idle");
      // Show what the server actually has.
      fetch("/api/meal-plan/current").then((r) => r.json()).then((d) => setPlan(d.plan ?? null)).catch(() => {});
      return;
    }
    const { day } = (await res.json()) as { day: PlanDay };
    setPlan((p) => (p ? { ...p, days: p.days.map((d, i) => (i === index ? day : d)) } : p));
    setSaveState("saved");
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
  }

  function editDay(index: number, build: (meals: PlanMeal[]) => PlanMeal[]) {
    if (!plan || logged.has(index)) return;
    setError("");
    const meals = build(plan.days[index].meals).filter((m) => m.items.length > 0);
    const day: PlanDay = { meals, totals: sumItems(meals.flatMap((m) => m.items)) };
    setPlan({ ...plan, days: plan.days.map((d, i) => (i === index ? day : d)) });
    const version = ++versionRef.current;
    pendingRef.current = { index, meals, version };
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void pushDay(index, meals, version), 500);
  }

  // Leaving the page inside the delay must not drop the last change.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      const p = pendingRef.current;
      if (!p) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      void pushDay(p.index, p.meals, p.version, true);
    };
  });
  useEffect(() => {
    const flush = () => flushRef.current();
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  function changeQty(mealIdx: number, itemIdx: number, dir: 1 | -1) {
    editDay(active, (meals) =>
      meals.map((m, mi) =>
        mi !== mealIdx
          ? m
          : {
              ...m,
              items: m.items.map((it, ii) => {
                if (ii !== itemIdx) return it;
                const { step, min, max } = qtyRange(it);
                const next = Math.min(max, Math.max(min, Math.round((it.quantity + dir * step) / step) * step));
                return next === it.quantity ? it : scaledItem(it, next);
              }),
            }
      )
    );
  }

  function removeItem(mealIdx: number, itemIdx: number) {
    editDay(active, (meals) => meals.map((m, mi) => (mi !== mealIdx ? m : { ...m, items: m.items.filter((_, ii) => ii !== itemIdx) })));
  }

  function addFood(slot: MealType, row: LibraryRow) {
    editDay(active, (meals) => {
      const item = itemFromLibrary(row);
      if (meals.some((m) => m.slot === slot)) return meals.map((m) => (m.slot === slot ? { ...m, items: [...m.items, item] } : m));
      return [...meals, { slot, items: [item] }].sort((a, b) => MEAL_TYPES.indexOf(a.slot) - MEAL_TYPES.indexOf(b.slot));
    });
    setAdding(null);
  }

  async function clearPlan() {
    const previous = plan;
    setPlan(null);
    const res = await fetch("/api/meal-plan/current", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setPlan(previous);
      setError("Couldn't clear the plan — try again.");
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
      versionRef.current++; // any edit still in flight belonged to the old plan
      pendingRef.current = null;
      setPlan({ target: data.target, days: data.days, startDate: data.startDate, loggedDays: data.loggedDays ?? [] });
      setActive(0);
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
    // The server must hold the same amounts that are about to be written to the diary.
    const pending = pendingRef.current;
    if (pending) {
      if (timerRef.current) clearTimeout(timerRef.current);
      await pushDay(pending.index, pending.meals, pending.version);
    }
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
      setPlan((p) => (p ? { ...p, loggedDays: [...new Set([...p.loggedDays, index])] } : p));
      void fetch("/api/meal-plan/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loggedDay: index }),
      }).catch(() => {});
      posthog.capture("meal_plan_day_logged");
    }
    setLogging(null);
  }

  const day = plan?.days[active];
  const editable = !logged.has(active);
  const dateLabel = (i: number) =>
    plan
      ? new Date(`${addDays(plan.startDate, i)}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
      : "";
  const missingSlots = day ? MEAL_TYPES.filter((s) => !day.meals.some((m) => m.slot === s)) : [];

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
          disabled={loading || restoring}
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
                <span className="block text-[10px] font-semibold uppercase">D{i + 1}{logged.has(i) ? " ✓" : ""}</span>
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
              <span className="text-[11px] text-zinc-500" aria-live="polite">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}
              </span>
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
                ⚠️ {w}. {editable ? "Adjust the amounts below or generate a new plan." : "Generate a new plan for a better balance."}
              </p>
            ))}
          </div>

          <div className="space-y-3">
            {day.meals.map((m, mi) => {
              const meta = SLOT_META[m.slot];
              const kcal = m.items.reduce((s, it) => s + it.calories, 0);
              return (
                <div key={m.slot} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
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
                    {m.items.map((it, ii) => {
                      const r = qtyRange(it);
                      return (
                        <div key={`${it.mealId}-${ii}`} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-zinc-200">{it.name}</span>
                          {editable && (
                            <button
                              onClick={() => changeQty(mi, ii, -1)}
                              disabled={it.quantity <= r.min}
                              aria-label={`Less ${it.name}`}
                              className="h-7 w-7 shrink-0 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                            >
                              −
                            </button>
                          )}
                          <span className="w-12 shrink-0 text-center text-xs text-zinc-400">{it.amountLabel}</span>
                          {editable && (
                            <button
                              onClick={() => changeQty(mi, ii, 1)}
                              disabled={it.quantity >= r.max}
                              aria-label={`More ${it.name}`}
                              className="h-7 w-7 shrink-0 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                            >
                              +
                            </button>
                          )}
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-400">{Math.round(it.calories)}</span>
                          {editable && (
                            <button
                              onClick={() => removeItem(mi, ii)}
                              aria-label={`Remove ${it.name}`}
                              className="shrink-0 px-0.5 text-zinc-600 hover:text-red-400"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {editable && (
                    <button
                      onClick={() => setAdding(m.slot)}
                      className="mt-2.5 w-full rounded-xl border border-dashed border-zinc-700 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    >
                      + Add food
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {editable && missingSlots.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-500">Add a meal:</span>
              {missingSlots.map((s) => (
                <button
                  key={s}
                  onClick={() => setAdding(s)}
                  className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300 hover:border-zinc-600"
                >
                  {SLOT_META[s]?.icon} {SLOT_META[s]?.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => logDay(active)}
            disabled={logging !== null || logged.has(active) || day.meals.length === 0}
            className="mt-4 w-full rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {logged.has(active)
              ? `✓ Logged to ${dateLabel(active)}`
              : logging === active
                ? "Logging…"
                : `Log this day to ${dateLabel(active)}`}
          </button>
          <button
            onClick={() => void clearPlan()}
            className="mt-2 w-full rounded-2xl py-2.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear plan
          </button>
        </>
      )}

      {adding && <AddFoodSheet slot={adding} onPick={(row) => addFood(adding, row)} onClose={() => setAdding(null)} />}
    </main>
  );
}
