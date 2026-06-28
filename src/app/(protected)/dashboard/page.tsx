"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface MealInfo {
  name: string;
  servingLabel: string;
  servingSize: number;
}

interface MealLog {
  id: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal: ({ id: string } & MealInfo) | null;
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
}

type ActionCard = {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  tone: "sky" | "emerald" | "amber";
};

function toDateString(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function differenceInDays(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function formatRelativeDate(date?: string | null, fallback = "Not logged yet") {
  if (!date) return fallback;

  const days = differenceInDays(date.slice(0, 10), toDateString(new Date()));
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

function percent(current: number, target: number) {
  if (!target) return 0;
  return Math.min((current / target) * 100, 100);
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong day";
  if (score >= 55) return "Good momentum";
  if (score >= 35) return "A few things left";
  return "Just getting started";
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 55) return "text-sky-300";
  if (score >= 35) return "text-amber-200";
  return "text-zinc-300";
}

function actionClasses(tone: ActionCard["tone"]) {
  if (tone === "emerald") return "border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/15";
  return "border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/15";
}

function mealInfo(log: MealLog): MealInfo {
  if (log.meal) return log.meal;

  return {
    name: log.mealSnapshot?.name ?? "Unknown meal",
    servingLabel: log.mealSnapshot?.servingLabel ?? "g",
    servingSize: log.mealSnapshot?.servingSize ?? 100,
  };
}

function formatQuantity(log: MealLog) {
  const { servingLabel, servingSize } = mealInfo(log);
  if (servingLabel === "piece") return `x${log.quantity}`;
  return `${Math.round(log.quantity * servingSize)}${servingLabel}`;
}

function MacroBar({
  label,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = percent(current, target);
  const remaining = Math.max(target - current, 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <span className="text-xs text-zinc-500">{Math.round(remaining)} {unit} left</span>
      </div>
      <div className="mb-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{Math.round(current)}</span>
        <span className="text-sm text-zinc-500">/ {target} {unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{note}</p>
    </div>
  );
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
    queueMicrotask(() => {
      void fetchData(selectedDate);
    });
  }, [selectedDate]);

  async function saveGymStatus(gymDay: boolean, split: string | null) {
    setSavingGym(true);
    await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        isGymDay: gymDay,
        gymSplit: split,
      }),
    });

    setData((previous) => previous ? { ...previous, isGymDay: gymDay, gymSplit: split } : previous);
    setShowGymPicker(false);
    setSavingGym(false);
  }

  async function removeMeal(id: string) {
    const log = data?.mealLogs.find((entry) => entry.id === id);
    if (!log) return;

    setData((previous) => previous ? {
      ...previous,
      mealLogs: previous.mealLogs.filter((entry) => entry.id !== id),
      totalCalories: previous.totalCalories - log.calories,
      totalProtein: previous.totalProtein - log.protein,
      totalCarbs: previous.totalCarbs - log.carbs,
      totalFat: previous.totalFat - log.fat,
    } : previous);

    const response = await fetch(`/api/log-meal/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setData((previous) => previous ? {
        ...previous,
        mealLogs: [...previous.mealLogs, log],
        totalCalories: previous.totalCalories + log.calories,
        totalProtein: previous.totalProtein + log.protein,
        totalCarbs: previous.totalCarbs + log.carbs,
        totalFat: previous.totalFat + log.fat,
      } : previous);
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
    const newCalories = log.calories * ratio;
    const newProtein = log.protein * ratio;
    const newCarbs = log.carbs * ratio;
    const newFat = log.fat * ratio;

    setData((previous) => previous ? {
      ...previous,
      mealLogs: previous.mealLogs.map((entry) => entry.id !== log.id ? entry : {
        ...entry,
        quantity: newQuantity,
        calories: newCalories,
        protein: newProtein,
        carbs: newCarbs,
        fat: newFat,
      }),
      totalCalories: previous.totalCalories - log.calories + newCalories,
      totalProtein: previous.totalProtein - log.protein + newProtein,
      totalCarbs: previous.totalCarbs - log.carbs + newCarbs,
      totalFat: previous.totalFat - log.fat + newFat,
    } : previous);

    const response = await fetch(`/api/log-meal/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity }),
    });

    if (!response.ok) {
      setData((previous) => previous ? {
        ...previous,
        mealLogs: previous.mealLogs.map((entry) => entry.id !== log.id ? entry : log),
        totalCalories: previous.totalCalories - newCalories + log.calories,
        totalProtein: previous.totalProtein - newProtein + log.protein,
        totalCarbs: previous.totalCarbs - newCarbs + log.carbs,
        totalFat: previous.totalFat - newFat + log.fat,
      } : previous);
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
    const netCalories = Math.round(data.totalCalories - data.caloriesBurned);
    const proteinLeft = Math.max(data.goals.protein - data.totalProtein, 0);
    const latestWeightDate = data.latestWeightLog?.date?.slice(0, 10);
    const latestMeasurementDate = data.latestMeasurementLog?.date?.slice(0, 10);
    const weightDays = latestWeightDate ? differenceInDays(latestWeightDate, todayStr) : 99;
    const measurementDays = latestMeasurementDate ? differenceInDays(latestMeasurementDate, todayStr) : 99;

    const insights = [
      proteinLeft > 0
        ? `Protein is still ${Math.round(proteinLeft)}g short today.`
        : "Protein target is covered today.",
      data.isGymDay
        ? `Workout is marked as ${data.gymSplit ?? "gym day"}.`
        : "No workout marked yet today.",
      weightDays >= 7
        ? "Weekly weigh-in is due."
        : latestWeightDate
          ? `Weight check-in is still fresh. ${formatRelativeDate(latestWeightDate)}.`
          : "No weigh-in yet. One weekly entry is enough to start.",
    ];

    const nextActions: ActionCard[] = [];

    if (data.mealLogs.length === 0) {
      nextActions.push({
        title: "Log your first meal",
        description: "Start the day with one meal entry.",
        href: `/meals?date=${selectedDate}`,
        tone: "sky",
      });
    } else if (proteinLeft > 0) {
      nextActions.push({
        title: "Close the protein gap",
        description: `${Math.round(proteinLeft)}g left to hit the target.`,
        href: `/meals?date=${selectedDate}`,
        tone: "emerald",
      });
    }

    if (!data.isGymDay) {
      nextActions.push({
        title: "Mark your workout",
        description: "Set today as gym day or rest day.",
        onClick: () => setShowGymPicker(true),
        tone: "amber",
      });
    }

    if (weightDays >= 7) {
      nextActions.push({
        title: "Do a quick weigh-in",
        description: latestWeightDate ? `Last one was ${weightDays} days ago.` : "Body check-ins are still empty.",
        href: `/body?date=${selectedDate}`,
        tone: "sky",
      });
    } else if (measurementDays >= 21) {
      nextActions.push({
        title: "Refresh measurements",
        description: latestMeasurementDate ? `Last block was ${measurementDays} days ago.` : "Optional every few weeks.",
        href: `/body?date=${selectedDate}`,
        tone: "amber",
      });
    }

    if (data.steps < data.goals.steps * 0.65) {
      nextActions.push({
        title: "Top up activity",
        description: `${(data.goals.steps - data.steps).toLocaleString()} steps left to reach your goal.`,
        href: `/body?date=${selectedDate}`,
        tone: "emerald",
      });
    }

    return {
      score,
      netCalories,
      proteinLeft,
      latestWeightDate,
      latestMeasurementDate,
      weightDays,
      measurementDays,
      insights,
      nextActions: nextActions.slice(0, 3),
    };
  }, [data, selectedDate, todayStr]);

  return (
    <main className="mx-auto max-w-5xl p-4 pb-10">
      <div className="mb-6 rounded-[28px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))] p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Your day, in one clear view.</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Less log list, more direction. The top section now tells you how the day is going and what deserves attention next.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2">
            <button onClick={() => changeDate(-1)} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700">
              Prev
            </button>
            <div className="min-w-[170px] text-center">
              <p className="text-sm text-zinc-300">{displayDate}</p>
              <p className="text-xs text-emerald-300">{isToday ? "Today" : "Past day"}</p>
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={isToday}
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {loading || !data || !summary ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Today&apos;s balance</p>
                  <h2 className="mt-1 text-2xl font-semibold">{
                    summary.score >= 80
                      ? "Everything is moving in the right direction."
                      : summary.score >= 55
                        ? "You are on track with a few useful nudges."
                        : "A couple of quick actions would clean this day up."
                  }</h2>
                  <p className={`mt-2 text-sm ${scoreTone(summary.score)}`}>{scoreLabel(summary.score)} • {summary.score}/100</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
                  <p className="text-xs text-zinc-500">Net calories</p>
                  <p className="text-3xl font-semibold">{summary.netCalories}</p>
                  <p className="text-xs text-zinc-400">Target {data.goals.calories}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Protein"
                  value={`${Math.round(data.totalProtein)}g`}
                  note={summary.proteinLeft > 0 ? `${Math.round(summary.proteinLeft)}g left today` : "Target reached"}
                />
                <StatCard
                  label="Steps"
                  value={data.steps ? data.steps.toLocaleString() : "--"}
                  note={`${Math.max(data.goals.steps - data.steps, 0).toLocaleString()} left to goal`}
                />
                <StatCard
                  label="Body"
                  value={data.latestWeightLog?.weight ? `${data.latestWeightLog.weight} kg` : "No weigh-in"}
                  note={summary.latestWeightDate ? formatRelativeDate(summary.latestWeightDate) : "Weekly check-ins work best here"}
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Coach notes</p>
              <h2 className="mt-1 text-xl font-semibold">What matters next</h2>

              <div className="mt-4 space-y-3">
                {summary.insights.map((insight) => (
                  <div key={insight} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Next actions</p>
                <h2 className="mt-1 text-xl font-semibold">Fast moves that improve the day</h2>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {summary.nextActions.map((action) => {
                const classes = `rounded-2xl border p-4 text-left transition ${actionClasses(action.tone)}`;

                if (action.href) {
                  return (
                    <Link key={action.title} href={action.href} className={classes}>
                      <p className="font-medium text-white">{action.title}</p>
                      <p className="mt-1 text-sm text-zinc-300">{action.description}</p>
                    </Link>
                  );
                }

                return (
                  <button key={action.title} onClick={action.onClick} className={classes}>
                    <p className="font-medium text-white">{action.title}</p>
                    <p className="mt-1 text-sm text-zinc-300">{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Nutrition</p>
                <h2 className="mt-1 text-xl font-semibold">Macro progress without the clutter</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MacroBar label="Calories" current={data.totalCalories} target={data.goals.calories} unit="kcal" color="bg-emerald-500" />
                <MacroBar label="Protein" current={data.totalProtein} target={data.goals.protein} unit="g" color="bg-sky-500" />
                <MacroBar label="Carbs" current={data.totalCarbs} target={data.goals.carbs} unit="g" color="bg-amber-500" />
                <MacroBar label="Fat" current={data.totalFat} target={data.goals.fat} unit="g" color="bg-rose-500" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Activity</p>
                <h2 className="mt-1 text-xl font-semibold">Movement and training</h2>

                <div className="mt-4 rounded-2xl bg-zinc-900 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{data.steps.toLocaleString()} steps</span>
                    <span className="text-zinc-500">/ {data.goals.steps.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent(data.steps, data.goals.steps)}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-zinc-400">
                    {data.caloriesBurned > 0 ? `${data.caloriesBurned} kcal burned from steps.` : "No calorie burn from steps logged yet."}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {data.isGymDay ? `${data.gymSplit ?? "Gym day"} is marked` : "Workout still not marked"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {data.isGymDay ? "You can still switch the split if needed." : "Mark gym day or keep it as rest day."}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowGymPicker((previous) => !previous)}
                      className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700"
                    >
                      {data.isGymDay ? "Change" : "Set day"}
                    </button>
                  </div>

                  {showGymPicker && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => void saveGymStatus(false, null)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                          !data.isGymDay ? "bg-zinc-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
                        }`}
                      >
                        Rest day
                      </button>
                      {(data.splits ?? []).filter((split) => split.name !== "Rest Day").map((split) => (
                        <button
                          key={split.id}
                          onClick={() => void saveGymStatus(true, split.name)}
                          disabled={savingGym}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                            data.isGymDay && data.gymSplit === split.name
                              ? "bg-emerald-600 text-white"
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

              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Body snapshot</p>
                <h2 className="mt-1 text-xl font-semibold">Keep check-ins lightweight</h2>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-zinc-900 p-4">
                    <p className="text-xs text-zinc-500">Latest weigh-in</p>
                    <p className="mt-1 text-lg font-semibold">
                      {data.latestWeightLog?.weight ? `${data.latestWeightLog.weight} kg` : "No entry yet"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {summary.latestWeightDate ? formatRelativeDate(summary.latestWeightDate) : "Weekly is enough here."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-900 p-4">
                    <p className="text-xs text-zinc-500">Measurement rhythm</p>
                    <p className="mt-1 text-lg font-semibold">
                      {summary.latestMeasurementDate ? "Tracked" : "Optional"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {summary.latestMeasurementDate ? formatRelativeDate(summary.latestMeasurementDate) : "Every 2 to 4 weeks is enough."}
                    </p>
                  </div>
                  <Link href={`/body?date=${selectedDate}`} className="block rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300 hover:border-zinc-500">
                    Open body check-ins
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Meals</p>
                <h2 className="mt-1 text-xl font-semibold">{isToday ? "Today’s food timeline" : `Meals for ${displayDate}`}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/meals?date=${selectedDate}`}
                  className="rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500"
                >
                  Add meal
                </Link>
                <span className="text-xs text-zinc-500">{data.mealLogs.length} logged</span>
              </div>
            </div>

            {data.mealLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">No meals logged yet.</p>
            ) : (
              <div className="space-y-3">
                {data.mealLogs.map((log) => {
                  const info = mealInfo(log);
                  const isPiece = info.servingLabel === "piece";
                  const step = isPiece ? 1 : 0.5;

                  return (
                    <div key={log.id} className="rounded-2xl bg-zinc-900 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{info.name}</p>
                          <p className="text-xs text-zinc-400">
                            {Math.round(log.calories)} kcal • P:{Math.round(log.protein)}g • C:{Math.round(log.carbs)}g • F:{Math.round(log.fat)}g
                          </p>
                        </div>
                        <button
                          onClick={() => void removeMeal(log.id)}
                          className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => void adjustMeal(log, -step)} className="rounded-lg bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700">
                          -
                        </button>
                        <span className="min-w-16 text-center text-sm font-medium">{formatQuantity(log)}</span>
                        <button onClick={() => void adjustMeal(log, step)} className="rounded-lg bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700">
                          +
                        </button>
                        <span className="text-xs text-zinc-500">{isPiece ? "pieces" : info.servingLabel}</span>
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
