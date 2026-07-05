"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, LinkCard } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { MacroChip } from "@/components/ui/MacroChip";
import { SectionHeader, EmptyState, Skeleton } from "@/components/ui/Primitives";
import { METRICS, SEMANTIC, scoreColor, percent } from "@/lib/metrics";

interface MealInfo {
  name: string;
  servingLabel: string;
  servingSize: number;
  imageUrl?: string | null;
}

interface MealLog {
  id: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt?: string;
  meal: ({ id: string; imageUrl?: string | null } & MealInfo) | null;
  mealSnapshot: MealInfo | null;
}

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
}

interface UserSplit {
  id: string;
  name: string;
  emoji: string;
}

interface SnapshotLog {
  date: string;
  weight?: number | null;
  waist?: number | null;
  bodyFat?: number | null;
}

interface WeekDay {
  date: string;
  weekday: string;
  hasMeals: boolean;
  hasWorkout: boolean;
  hasWeighIn: boolean;
}

interface DashboardData {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealLogs: MealLog[];
  goals: Goals;
  steps: number;
  caloriesBurned: number;
  water: number;
  sleep: number;
  isGymDay: boolean;
  gymSplit: string | null;
  splits: UserSplit[];
  latestWeightLog?: SnapshotLog | null;
  latestMeasurementLog?: SnapshotLog | null;
  week: WeekDay[];
  streak: { current: number; longest: number };
}

type CoachType = "nutrition" | "workout" | "body" | "activity";

interface CoachTip {
  type: CoachType;
  message: string;
  cta: string;
  href?: string;
  onClick?: () => void;
}

const COACH_ACCENT: Record<CoachType, string> = {
  nutrition: METRICS.calories.hex,
  workout: SEMANTIC.accent,
  body: METRICS.steps.hex,
  activity: METRICS.water.hex,
};

const WATER_TARGET_DEFAULT = 2.5;
const SLEEP_TARGET_DEFAULT = 8;
const WATER_STEP = 0.25;

function toDateString(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function differenceInDays(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function mealInfo(log: MealLog): MealInfo {
  if (log.meal) return log.meal;
  return {
    name: log.mealSnapshot?.name ?? "Unknown meal",
    servingLabel: log.mealSnapshot?.servingLabel ?? "g",
    servingSize: log.mealSnapshot?.servingSize ?? 100,
    imageUrl: log.mealSnapshot?.imageUrl ?? null,
  };
}

function formatQuantity(log: MealLog) {
  const { servingLabel, servingSize } = mealInfo(log);
  if (servingLabel === "piece") return `x${log.quantity}`;
  return `${Math.round(log.quantity * servingSize)}${servingLabel}`;
}

// ── Meal-time grouping (by log time — best available signal) ────────────────
type MealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snack";
const SLOT_ORDER: MealSlot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const SLOT_ICON: Record<MealSlot, string> = {
  Breakfast: "🌅",
  Lunch: "☀️",
  Dinner: "🌙",
  Snack: "🍎",
};

function slotFor(log: MealLog): MealSlot {
  if (!log.createdAt) return "Snack";
  const hour = new Date(log.createdAt).getHours();
  if (hour >= 4 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 16) return "Lunch";
  if (hour >= 16 && hour < 22) return "Dinner";
  return "Snack";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [showGymPicker, setShowGymPicker] = useState(false);
  const [savingGym, setSavingGym] = useState(false);

  async function fetchData(date: string) {
    setLoading(true);
    const response = await fetch(`/api/dashboard?date=${date}`);
    const json = await response.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => void fetchData(selectedDate));
  }, [selectedDate]);

  async function saveGymStatus(gymDay: boolean, split: string | null) {
    setSavingGym(true);
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, isGymDay: gymDay, gymSplit: split }),
    });
    setData((p) => (p ? { ...p, isGymDay: gymDay, gymSplit: split } : p));
    setShowGymPicker(false);
    setSavingGym(false);
  }

  async function addWater(delta: number) {
    if (!data) return;
    const next = Math.max(0, Math.round((data.water + delta) * 100) / 100);
    setData((p) => (p ? { ...p, water: next } : p));
    const response = await fetch("/api/body", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, water: next }),
    });
    if (!response.ok) setData((p) => (p ? { ...p, water: data.water } : p));
  }

  async function removeMeal(id: string) {
    const log = data?.mealLogs.find((entry) => entry.id === id);
    if (!log) return;
    setData((p) =>
      p
        ? {
            ...p,
            mealLogs: p.mealLogs.filter((e) => e.id !== id),
            totalCalories: p.totalCalories - log.calories,
            totalProtein: p.totalProtein - log.protein,
            totalCarbs: p.totalCarbs - log.carbs,
            totalFat: p.totalFat - log.fat,
          }
        : p
    );
    const response = await fetch(`/api/log-meal/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setData((p) =>
        p
          ? {
              ...p,
              mealLogs: [...p.mealLogs, log],
              totalCalories: p.totalCalories + log.calories,
              totalProtein: p.totalProtein + log.protein,
              totalCarbs: p.totalCarbs + log.carbs,
              totalFat: p.totalFat + log.fat,
            }
          : p
      );
    }
  }

  async function adjustMeal(log: MealLog, delta: number) {
    const info = mealInfo(log);
    const deltaQuantity = info.servingLabel === "piece" ? delta : delta / info.servingSize;
    const newQuantity = log.quantity + deltaQuantity;
    if (newQuantity <= 0) {
      await removeMeal(log.id);
      return;
    }
    const ratio = newQuantity / log.quantity;
    const patched = {
      quantity: newQuantity,
      calories: log.calories * ratio,
      protein: log.protein * ratio,
      carbs: log.carbs * ratio,
      fat: log.fat * ratio,
    };
    setData((p) =>
      p
        ? {
            ...p,
            mealLogs: p.mealLogs.map((e) => (e.id !== log.id ? e : { ...e, ...patched })),
            totalCalories: p.totalCalories - log.calories + patched.calories,
            totalProtein: p.totalProtein - log.protein + patched.protein,
            totalCarbs: p.totalCarbs - log.carbs + patched.carbs,
            totalFat: p.totalFat - log.fat + patched.fat,
          }
        : p
    );
    const response = await fetch(`/api/log-meal/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity }),
    });
    if (!response.ok) {
      setData((p) =>
        p
          ? {
              ...p,
              mealLogs: p.mealLogs.map((e) => (e.id !== log.id ? e : log)),
              totalCalories: p.totalCalories - patched.calories + log.calories,
              totalProtein: p.totalProtein - patched.protein + log.protein,
              totalCarbs: p.totalCarbs - patched.carbs + log.carbs,
              totalFat: p.totalFat - patched.fat + log.fat,
            }
          : p
      );
    }
  }

  function changeDate(offset: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    setSelectedDate(toDateString(date));
  }

  const todayStr = toDateString(new Date());
  const isToday = selectedDate === todayStr;
  const displayDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const summary = useMemo(() => {
    if (!data) return null;

    const caloriePct = percent(data.totalCalories, data.goals.calories);
    const proteinPct = percent(data.totalProtein, data.goals.protein);
    const stepsPct = percent(data.steps, data.goals.steps);
    const gymPct = data.isGymDay ? 100 : 20;
    const score = Math.round((caloriePct + proteinPct + stepsPct + gymPct) / 4);

    const proteinLeft = Math.max(data.goals.protein - data.totalProtein, 0);
    const caloriesLeft = Math.max(data.goals.calories - data.totalCalories, 0);
    const stepsLeft = Math.max(data.goals.steps - data.steps, 0);
    const latestWeightDate = data.latestWeightLog?.date?.slice(0, 10);
    const weightDays = latestWeightDate ? differenceInDays(latestWeightDate, todayStr) : 99;
    const nextSplit = data.splits.find((s) => s.name !== "Rest Day");

    // ── AI Coach: actionable, positive-framed tips with CTAs ──
    const tips: CoachTip[] = [];
    if (proteinLeft > 0) {
      tips.push({
        type: "nutrition",
        message: `Hit your protein — ${Math.round(proteinLeft)}g to go. Log a high-protein meal to close the gap.`,
        cta: "Log protein",
        href: `/meals?date=${selectedDate}`,
      });
    } else if (data.mealLogs.length > 0) {
      tips.push({
        type: "nutrition",
        message: "Protein target is covered today — nice work staying on top of it.",
        cta: "Review meals",
        href: `/meals?date=${selectedDate}`,
      });
    }
    if (!data.isGymDay) {
      tips.push({
        type: "workout",
        message: nextSplit
          ? `No workout logged yet. ${nextSplit.emoji} ${nextSplit.name} is ready when you are.`
          : "No workout logged yet. Mark today as a gym or rest day.",
        cta: "Set training",
        onClick: () => setShowGymPicker(true),
      });
    }
    if (weightDays >= 7) {
      tips.push({
        type: "body",
        message: latestWeightDate
          ? `Weigh-in overdue (${weightDays} days). A quick log keeps your trend accurate.`
          : "No weigh-in yet — one entry unlocks your weight trend.",
        cta: "Quick log",
        href: `/body?date=${selectedDate}`,
      });
    }
    if (data.steps < data.goals.steps * 0.65 && data.goals.steps > 0) {
      tips.push({
        type: "activity",
        message: `${stepsLeft.toLocaleString()} steps to your goal. A short walk gets you there.`,
        cta: "Log steps",
        href: `/body?date=${selectedDate}`,
      });
    }
    if (tips.length === 0) {
      tips.push({
        type: "nutrition",
        message: "Everything's logged and on target today. Keep the momentum going! 🔥",
        cta: "View stats",
        href: "/analytics",
      });
    }

    // ── Context-aware quick actions (max 3) ──
    const actions: CoachTip[] = [];
    if (data.mealLogs.length === 0) {
      actions.push({ type: "nutrition", message: "Log Meal", cta: "", href: `/meals?date=${selectedDate}` });
    } else if (proteinLeft > 0) {
      actions.push({ type: "nutrition", message: "Add Meal", cta: "", href: `/meals?date=${selectedDate}` });
    }
    if (!data.isGymDay) {
      actions.push({ type: "workout", message: "Start Workout", cta: "", href: "/workout" });
    }
    if (weightDays >= 7) {
      actions.push({ type: "body", message: "Log Weight", cta: "", href: `/body?date=${selectedDate}` });
    }

    return {
      score,
      proteinLeft,
      caloriesLeft,
      stepsLeft,
      weightDays,
      tips: tips.slice(0, 3),
      actions: actions.slice(0, 3),
      allDone: actions.length === 0,
    };
  }, [data, selectedDate, todayStr]);

  const mealGroups = useMemo(() => {
    if (!data) return [];
    const groups = new Map<MealSlot, MealLog[]>();
    for (const log of data.mealLogs) {
      const slot = slotFor(log);
      if (!groups.has(slot)) groups.set(slot, []);
      groups.get(slot)!.push(log);
    }
    return SLOT_ORDER.filter((s) => groups.has(s)).map((slot) => {
      const logs = groups.get(slot)!;
      return {
        slot,
        logs,
        calories: logs.reduce((sum, l) => sum + l.calories, 0),
      };
    });
  }, [data]);

  return (
    <main className="mx-auto max-w-5xl p-4 pb-10">
      {/* ── Header + date nav ── */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-green-400/80">
            Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {isToday ? "Today" : displayDate}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1.5">
          <button
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
            className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
          >
            ‹
          </button>
          <span className="min-w-[130px] text-center text-sm text-zinc-300">{displayDate}</span>
          <button
            onClick={() => changeDate(1)}
            disabled={isToday}
            aria-label="Next day"
            className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {loading || !data || !summary ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── 1. Hero summary bar ── */}
          <Card tier="primary">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <ProgressRing value={summary.score} color={scoreColor(summary.score)} size={132} stroke={12}>
                <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(summary.score) }}>
                  {summary.score}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">score</span>
              </ProgressRing>

              <div className="flex-1 space-y-3">
                {summary.score === 0 ? (
                  <div>
                    <p className="text-lg font-semibold text-white">Start your day 💪</p>
                    <p className="text-sm text-zinc-400">Log a meal or workout to get your score moving.</p>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-white">
                    {summary.score >= 80
                      ? "Strong day — everything's moving in the right direction."
                      : summary.score >= 55
                        ? "Good momentum. A couple of quick wins left."
                        : "You're getting started — a few actions will lift your day."}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <StatPill
                    label="Calories"
                    value={`${Math.round(data.totalCalories)}`}
                    sub={`/ ${data.goals.calories}`}
                    color={METRICS.calories.hex}
                  />
                  <StatPill
                    label="Protein"
                    value={`${Math.round(data.totalProtein)}g`}
                    sub={`/ ${data.goals.protein}g`}
                    color={METRICS.protein.hex}
                  />
                  <StatPill
                    label="Workout"
                    value={data.isGymDay ? "Logged" : "—"}
                    sub={data.isGymDay ? (data.gymSplit ?? "Gym day") : "Not logged"}
                    color={SEMANTIC.accent}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── 2. AI Coach ── */}
          <section>
            <SectionHeader eyebrow="AI Coach" title="What matters next" />
            <div className="space-y-2.5">
              {summary.tips.map((tip) => (
                <Card key={tip.message} accent={COACH_ACCENT[tip.type]} className="flex items-center gap-3">
                  <p className="flex-1 text-sm text-zinc-200">{tip.message}</p>
                  {tip.href ? (
                    <Link
                      href={tip.href}
                      className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                      style={{ backgroundColor: COACH_ACCENT[tip.type] }}
                    >
                      {tip.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={tip.onClick}
                      className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                      style={{ backgroundColor: COACH_ACCENT[tip.type] }}
                    >
                      {tip.cta}
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {/* ── 3. Quick actions ── */}
          {!summary.allDone && (
            <section>
              <SectionHeader eyebrow="Quick actions" title="Fast moves for today" />
              <div className="grid gap-3 sm:grid-cols-3">
                {summary.actions.map((action, i) => (
                  <Link
                    key={action.message}
                    href={action.href!}
                    className={`rounded-2xl border p-4 text-center text-sm font-semibold transition hover:-translate-y-0.5 ${
                      i === 0
                        ? "border-transparent bg-green-600 text-white hover:bg-green-500"
                        : "border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/70"
                    }`}
                  >
                    {action.message}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── 4 + 5. Nutrition & Activity overviews ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Nutrition */}
            <LinkCard href={`/meals?date=${selectedDate}`} className="!p-5">
              <SectionHeader eyebrow="Nutrition" title="Macros at a glance" />
              <div className="mb-3">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
                    {Math.round(data.totalCalories)}
                    <span className="ml-1 text-sm font-medium text-zinc-500">/ {data.goals.calories} kcal</span>
                  </span>
                  <span className="text-xs text-zinc-500">{Math.round(summary.caloriesLeft)} left</span>
                </div>
                <ProgressBar value={data.totalCalories} target={data.goals.calories} color={METRICS.calories.hex} height={10} />
              </div>
              <div className="space-y-2.5">
                <MacroRow label="Protein" metric="protein" current={data.totalProtein} target={data.goals.protein} />
                <MacroRow label="Carbs" metric="carbs" current={data.totalCarbs} target={data.goals.carbs} />
                <MacroRow label="Fat" metric="fat" current={data.totalFat} target={data.goals.fat} />
              </div>
            </LinkCard>

            {/* Activity */}
            <Card tier="secondary" className="!p-5">
              <SectionHeader eyebrow="Activity" title="Movement & recovery" />
              <div className="space-y-4">
                {/* Steps */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-zinc-300">Steps</span>
                    <span className="tabular-nums text-zinc-400">
                      {data.steps.toLocaleString()} / {data.goals.steps.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={data.steps} target={data.goals.steps} color={METRICS.steps.hex} />
                </div>
                {/* Water with + button */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-zinc-300">Water</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-zinc-400">
                        {data.water.toFixed(2)} / {WATER_TARGET_DEFAULT} L
                      </span>
                      <button
                        onClick={() => void addWater(-WATER_STEP)}
                        disabled={data.water <= 0}
                        aria-label="Remove a glass of water"
                        className="h-6 w-6 rounded-lg bg-zinc-800 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <button
                        onClick={() => void addWater(WATER_STEP)}
                        aria-label="Add a glass of water"
                        className="h-6 w-6 rounded-lg text-sm font-bold text-white hover:opacity-90"
                        style={{ backgroundColor: METRICS.water.hex }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <ProgressBar value={data.water} target={WATER_TARGET_DEFAULT} color={METRICS.water.hex} />
                </div>
                {/* Sleep */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-zinc-300">Sleep</span>
                    <span className="tabular-nums text-zinc-400">
                      {data.sleep ? `${data.sleep} h` : "Not logged"}
                    </span>
                  </div>
                  <ProgressBar value={data.sleep} target={SLEEP_TARGET_DEFAULT} color={METRICS.sleep.hex} />
                </div>
                {/* Workout status */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {data.isGymDay ? `${data.gymSplit ?? "Gym day"}` : "Rest day"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {data.isGymDay ? "Training set for today" : "No workout marked yet"}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowGymPicker((v) => !v)}
                      className="rounded-xl bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                    >
                      {data.isGymDay ? "Change" : "Set day"}
                    </button>
                  </div>
                  {showGymPicker && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => void saveGymStatus(false, null)}
                        disabled={savingGym}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                          !data.isGymDay ? "bg-zinc-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
                        }`}
                      >
                        Rest day
                      </button>
                      {data.splits
                        .filter((s) => s.name !== "Rest Day")
                        .map((split) => (
                          <button
                            key={split.id}
                            onClick={() => void saveGymStatus(true, split.name)}
                            disabled={savingGym}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                              data.isGymDay && data.gymSplit === split.name
                                ? "bg-green-600 text-white"
                                : "bg-zinc-800 hover:bg-zinc-700"
                            }`}
                          >
                            {split.emoji} {split.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ── 6. Today's meals timeline ── */}
          <section>
            <SectionHeader
              eyebrow="Meals"
              title={isToday ? "Today's timeline" : "Meal timeline"}
              action={
                <Link
                  href={`/meals?date=${selectedDate}`}
                  className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
                >
                  + Add meal
                </Link>
              }
            />
            {data.mealLogs.length === 0 ? (
              <EmptyState
                icon="🍽️"
                title="No meals logged yet"
                message={`${data.goals.calories} kcal to go — log your first meal to start the day.`}
                ctaLabel="Log a meal"
                ctaHref={`/meals?date=${selectedDate}`}
              />
            ) : (
              <div className="space-y-4">
                {mealGroups.map((group) => (
                  <Card key={group.slot} tier="secondary">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SLOT_ICON[group.slot]}</span>
                        <span className="text-sm font-semibold text-white">{group.slot}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: METRICS.calories.hex }}>
                        {Math.round(group.calories)} kcal
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {group.logs.map((log) => {
                        const info = mealInfo(log);
                        const isPiece = info.servingLabel === "piece";
                        const step = isPiece ? 1 : 0.5;
                        return (
                          <div key={log.id} className="rounded-xl bg-zinc-900/70 p-3">
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                {info.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={info.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                                ) : (
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-sm">🍴</div>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-white">{info.name}</p>
                                  <p className="text-xs tabular-nums" style={{ color: METRICS.calories.hex }}>
                                    {Math.round(log.calories)} kcal
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => void removeMeal(log.id)}
                                aria-label={`Remove ${info.name}`}
                                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <MacroChip metric="protein" value={log.protein} />
                                <MacroChip metric="carbs" value={log.carbs} />
                                <MacroChip metric="fat" value={log.fat} />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void adjustMeal(log, -step)}
                                  aria-label="Decrease quantity"
                                  className="h-7 w-7 rounded-lg bg-zinc-800 text-sm hover:bg-zinc-700"
                                >
                                  −
                                </button>
                                <span className="min-w-14 text-center text-xs font-medium tabular-nums">
                                  {formatQuantity(log)}
                                </span>
                                <button
                                  onClick={() => void adjustMeal(log, step)}
                                  aria-label="Increase quantity"
                                  className="h-7 w-7 rounded-lg bg-zinc-800 text-sm hover:bg-zinc-700"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ── 7. Weekly glance ── */}
          <section>
            <SectionHeader eyebrow="This week" title="Consistency at a glance" />
            <Card tier="secondary">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 justify-between">
                  {data.week.map((day) => (
                    <div key={day.date} className="flex flex-col items-center gap-1.5">
                      <span className="text-[11px] uppercase text-zinc-500">{day.weekday}</span>
                      <div className="flex flex-col gap-1">
                        <Dot on={day.hasMeals} color={SEMANTIC.success} />
                        <Dot on={day.hasWorkout} color={METRICS.calories.hex} />
                        <Dot on={day.hasWeighIn} color={METRICS.protein.hex} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-l border-zinc-800 pl-4 text-center">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl">🔥</span>
                    <span className="text-3xl font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
                      {data.streak.current}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">day streak</p>
                  {data.streak.longest > 0 && (
                    <p className="mt-1 text-[11px] text-zinc-600">Best: {data.streak.longest}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 border-t border-zinc-800 pt-3 text-[11px] text-zinc-500">
                <Legend color={SEMANTIC.success} label="Meals" />
                <Legend color={METRICS.calories.hex} label="Workout" />
                <Legend color={METRICS.protein.hex} label="Weigh-in" />
              </div>
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}

// ── Small local presentational helpers ──────────────────────────────────────

function StatPill({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-lg font-bold leading-tight tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-zinc-500">{sub}</p>
    </div>
  );
}

function MacroRow({
  label,
  metric,
  current,
  target,
}: {
  label: string;
  metric: "protein" | "carbs" | "fat";
  current: number;
  target: number;
}) {
  const remaining = Math.max(target - current, 0);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {Math.round(current)} / {target}g · {Math.round(remaining)} left
        </span>
      </div>
      <ProgressBar value={current} target={target} color={METRICS[metric].hex} height={6} />
    </div>
  );
}

function Dot({ on, color }: { on: boolean; color: string }) {
  return (
    <div
      className="h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: on ? color : "#27272a" }}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
