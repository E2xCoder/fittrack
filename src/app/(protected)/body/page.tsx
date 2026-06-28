"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

interface UserProfile {
  height?: number;
  weight?: number;
  stepTarget?: number;
  waterTarget?: number;
  sleepTarget?: number;
}

interface HistoryLog {
  date: string;
  weight?: number;
  steps?: number;
  water?: number;
  sleep?: number;
  waist?: number;
  chest?: number;
  hip?: number;
  arm?: number;
  leg?: number;
  bodyFat?: number;
  caloriesBurned?: number;
}

type BodyForm = {
  weight: string;
  steps: string;
  water: string;
  sleep: string;
  waist: string;
  chest: string;
  hip: string;
  arm: string;
  leg: string;
  bodyFat: string;
};

type BodyAiSummary = {
  summary: string;
  trends: string[];
  focus: string[];
  caution: string | null;
};

const EMPTY_FORM: BodyForm = {
  weight: "",
  steps: "",
  water: "",
  sleep: "",
  waist: "",
  chest: "",
  hip: "",
  arm: "",
  leg: "",
  bodyFat: "",
};

function toDateString(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function differenceInDays(from: string, to: string) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function formatRelative(lastDate?: string, fallback = "Not logged yet") {
  if (!lastDate) return fallback;

  const days = differenceInDays(lastDate.slice(0, 10), toDateString(new Date()));
  if (days <= 0) return "Logged today";
  if (days === 1) return "Last updated yesterday";
  return `Last updated ${days} days ago`;
}

function getDueState(daysSince: number, warningAt: number, overdueAt: number) {
  if (daysSince >= overdueAt) return "overdue";
  if (daysSince >= warningAt) return "soon";
  return "fresh";
}

function dueClasses(state: "fresh" | "soon" | "overdue") {
  if (state === "overdue") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  if (state === "soon") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function progressTone(value: number, target: number) {
  if (value >= target) return "bg-emerald-400";
  if (value >= target * 0.7) return "bg-amber-400";
  return "bg-sky-400";
}

function ProgressBar({
  value,
  target,
  unit,
}: {
  value: number;
  target: number;
  unit: string;
}) {
  const pct = Math.min((value / target) * 100, 100);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{value} {unit}</span>
        <span>/ {target} {unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${progressTone(value, target)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WeightChart({ data }: { data: HistoryLog[] }) {
  const weights = data
    .filter((entry) => entry.weight)
    .map((entry) => ({ date: entry.date, weight: Number(entry.weight) }));

  if (weights.length < 2) {
    return <p className="py-4 text-center text-xs text-zinc-500">Add at least 2 weigh-ins to see the trend.</p>;
  }

  const min = Math.min(...weights.map((entry) => entry.weight)) - 0.5;
  const max = Math.max(...weights.map((entry) => entry.weight)) + 0.5;
  const range = max - min || 1;
  const width = 300;
  const height = 90;

  const points = weights.map((entry, index) => ({
    x: weights.length === 1 ? width / 2 : (index / (weights.length - 1)) * (width - 20) + 10,
    y: height - 12 - ((entry.weight - min) / range) * (height - 24),
    ...entry,
  }));

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const delta = weights[weights.length - 1].weight - weights[0].weight;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-zinc-500">{weights[0].weight} to {weights[weights.length - 1].weight} kg</span>
        <span className={delta < 0 ? "text-emerald-400" : delta > 0 ? "text-amber-300" : "text-zinc-400"}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} kg
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#weight-fill)" />
        <path d={line} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3" fill="#38bdf8" />
        ))}
      </svg>
    </div>
  );
}

function CalendarView({ history, stepTarget }: { history: HistoryLog[]; stepTarget: number }) {
  const [selectedDay, setSelectedDay] = useState<HistoryLog | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const historyMap = useMemo(() => {
    const map: Record<string, HistoryLog> = {};
    history.forEach((log) => {
      map[log.date.slice(0, 10)] = log;
    });
    return map;
  }, [history]);

  const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
  const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const totalDays = lastDay.getDate();
  const today = toDateString(new Date());
  const monthName = firstDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function prevMonth() {
    setViewMonth((previous) => {
      if (previous.month === 0) return { year: previous.year - 1, month: 11 };
      return { year: previous.year, month: previous.month - 1 };
    });
    setSelectedDay(null);
  }

  function nextMonth() {
    const now = new Date();
    if (viewMonth.year === now.getFullYear() && viewMonth.month === now.getMonth()) return;

    setViewMonth((previous) => {
      if (previous.month === 11) return { year: previous.year + 1, month: 0 };
      return { year: previous.year, month: previous.month + 1 };
    });
    setSelectedDay(null);
  }

  const isCurrentMonth =
    viewMonth.year === new Date().getFullYear() &&
    viewMonth.month === new Date().getMonth();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700">
          Prev
        </button>
        <p className="font-semibold">{monthName}</p>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((day) => (
          <div key={day} className="py-1 text-xs text-zinc-600">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }).map((_, index) => (
          <div key={`empty-${index}`} />
        ))}

        {Array.from({ length: totalDays }).map((_, index) => {
          const day = index + 1;
          const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log = historyMap[dateStr];
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          const hasSteps = !!log?.steps && Number(log.steps) > 0;
          const hitStepGoal = hasSteps && Number(log?.steps) >= stepTarget;
          const hasWeight = !!log?.weight;
          const isSelected = selectedDay?.date?.slice(0, 10) === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && setSelectedDay(isSelected ? null : log ?? { date: dateStr })}
              disabled={isFuture}
              className={`rounded-xl py-2 transition ${
                isSelected
                  ? "bg-zinc-800 ring-2 ring-sky-500"
                  : isToday
                    ? "bg-sky-950/60 ring-1 ring-sky-700"
                    : log
                      ? "bg-zinc-800/60 hover:bg-zinc-800"
                      : "hover:bg-zinc-900"
              } ${isFuture ? "opacity-20" : ""}`}
            >
              <span className={`text-xs font-medium ${isToday ? "text-sky-300" : log ? "text-white" : "text-zinc-600"}`}>
                {day}
              </span>
              <div className="mt-1 flex justify-center gap-1">
                {hasSteps && (
                  <div className={`h-1.5 w-1.5 rounded-full ${hitStepGoal ? "bg-emerald-400" : "bg-amber-300"}`} />
                )}
                {hasWeight && <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-400" /><span>Steps target</span></div>
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-amber-300" /><span>Steps logged</span></div>
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-sky-400" /><span>Weight logged</span></div>
      </div>

      {selectedDay && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 font-semibold">
            {new Date(`${selectedDay.date.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>

          {!selectedDay.steps && !selectedDay.weight && !selectedDay.water && !selectedDay.sleep ? (
            <p className="text-sm text-zinc-500">No data logged on this day.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {selectedDay.steps && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">Steps</p>
                  <p className="text-lg font-bold">{Number(selectedDay.steps).toLocaleString()}</p>
                </div>
              )}
              {selectedDay.weight && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">Weight</p>
                  <p className="text-lg font-bold">{selectedDay.weight} kg</p>
                </div>
              )}
              {selectedDay.water && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">Water</p>
                  <p className="text-lg font-bold">{selectedDay.water} L</p>
                </div>
              )}
              {selectedDay.sleep && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">Sleep</p>
                  <p className="text-lg font-bold">{selectedDay.sleep} h</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone: "fresh" | "soon" | "overdue";
}) {
  return (
    <div className={`rounded-2xl border p-4 ${dueClasses(tone)}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-300/70">{title}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-zinc-300">{note}</p>
    </div>
  );
}

function MetricInput({
  label,
  hint,
  value,
  onChange,
  step,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <label className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <span className="mb-3 block text-xs text-zinc-500">{hint}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl bg-zinc-800 p-3 outline-none transition focus:ring-1 focus:ring-zinc-600"
      />
    </label>
  );
}

function BodyContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState(() => dateParam ?? toDateString(new Date()));
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "checkin" | "progress">("today");
  const [form, setForm] = useState<BodyForm>(EMPTY_FORM);
  const [aiSummary, setAiSummary] = useState<BodyAiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiRequestId = useRef(0);

  async function fetchData(date: string) {
    aiRequestId.current += 1;
    setAiSummary(null);
    setAiError("");
    setAiLoading(false);
    const response = await fetch(`/api/body?date=${date}`);
    const data = await response.json();

    setUserProfile(data.userProfile ?? {});

    if (data.bodyLog) {
      setForm({
        weight: data.bodyLog.weight ? String(data.bodyLog.weight) : "",
        steps: data.bodyLog.steps ? String(data.bodyLog.steps) : "",
        water: data.bodyLog.water ? String(data.bodyLog.water) : "",
        sleep: data.bodyLog.sleep ? String(data.bodyLog.sleep) : "",
        waist: data.bodyLog.waist ? String(data.bodyLog.waist) : "",
        chest: data.bodyLog.chest ? String(data.bodyLog.chest) : "",
        hip: data.bodyLog.hip ? String(data.bodyLog.hip) : "",
        arm: data.bodyLog.arm ? String(data.bodyLog.arm) : "",
        leg: data.bodyLog.leg ? String(data.bodyLog.leg) : "",
        bodyFat: data.bodyLog.bodyFat ? String(data.bodyLog.bodyFat) : "",
      });
    } else {
      setForm(EMPTY_FORM);
    }

    setHasChanges(false);
    setLoadedDate(date);
  }

  async function fetchHistory() {
    const response = await fetch("/api/body/history?days=120");
    const data = await response.json();
    setHistory(data);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData(selectedDate);
      void fetchHistory();
    });
  }, [selectedDate]);

  useEffect(() => {
    if (!hasChanges || loadedDate !== selectedDate) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      setSaveError(false);

      try {
        const response = await fetch("/api/body", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, date: selectedDate }),
        });

        if (!response.ok) throw new Error("Save failed");

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        fetchHistory();
      } catch {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form, hasChanges, loadedDate, selectedDate]);

  function updateForm(key: keyof BodyForm, value: string) {
    aiRequestId.current += 1;
    setForm((previous) => ({ ...previous, [key]: value }));
    setAiSummary(null);
    setAiError("");
    setAiLoading(false);
    setHasChanges(true);
    setSaved(false);
    setSaveError(false);
  }

  async function generateAiSummary() {
    const checkIn = {
      weight: form.weight,
      bodyFat: form.bodyFat,
      waist: form.waist,
      chest: form.chest,
      hip: form.hip,
      arm: form.arm,
      leg: form.leg,
    };

    if (!Object.values(checkIn).some(Boolean)) {
      setAiError("Add at least one weight, body-fat, or measurement value first.");
      return;
    }

    setAiLoading(true);
    setAiError("");
    const requestId = ++aiRequestId.current;

    try {
      const response = await fetch("/api/body-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, checkIn }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Body check-in summary failed.");
      }

      if (requestId !== aiRequestId.current) return;

      setAiSummary({
        summary: typeof json.summary === "string" ? json.summary : "Check-in recorded.",
        trends: Array.isArray(json.trends) ? json.trends : [],
        focus: Array.isArray(json.focus) ? json.focus : [],
        caution: typeof json.caution === "string" ? json.caution : null,
      });
    } catch (error) {
      if (requestId !== aiRequestId.current) return;
      setAiError(error instanceof Error ? error.message : "Body check-in summary failed.");
    } finally {
      if (requestId === aiRequestId.current) setAiLoading(false);
    }
  }

  function changeDate(offset: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    setSelectedDate(toDateString(date));
  }

  const isToday = selectedDate === toDateString(new Date());
  const displayDate = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const bmi = userProfile.height && userProfile.weight
    ? (userProfile.weight / ((userProfile.height / 100) ** 2)).toFixed(1)
    : null;

  const bmiCategory = bmi
    ? Number(bmi) < 18.5
      ? "Underweight"
      : Number(bmi) < 25
        ? "Balanced"
        : Number(bmi) < 30
          ? "Above range"
          : "High"
    : null;

  const weightEntries = history.filter((entry) => entry.weight).sort((a, b) => a.date.localeCompare(b.date));
  const measurementEntries = history
    .filter((entry) => entry.waist || entry.chest || entry.hip || entry.arm || entry.leg || entry.bodyFat)
    .sort((a, b) => a.date.localeCompare(b.date));

  const lastWeight = weightEntries.at(-1);
  const previousWeight = weightEntries.length > 1 ? weightEntries.at(-2) : null;
  const lastMeasurement = measurementEntries.at(-1);

  const daysSinceWeight = lastWeight ? differenceInDays(lastWeight.date.slice(0, 10), toDateString(new Date())) : 99;
  const daysSinceMeasurement = lastMeasurement ? differenceInDays(lastMeasurement.date.slice(0, 10), toDateString(new Date())) : 99;
  const weighInState = getDueState(daysSinceWeight, 5, 8);
  const measurementState = getDueState(daysSinceMeasurement, 18, 30);

  const stepsValue = Number(form.steps) || 0;
  const waterValue = Number(form.water) || 0;
  const sleepValue = Number(form.sleep) || 0;

  const caloriesBurned = Math.round(stepsValue * 0.04 * ((userProfile.weight ?? 70) / 70));
  const weightDelta = lastWeight && previousWeight ? Number(lastWeight.weight) - Number(previousWeight.weight) : null;

  const measurementSummary = [
    form.waist && `Waist ${form.waist} cm`,
    form.chest && `Chest ${form.chest} cm`,
    form.hip && `Hip ${form.hip} cm`,
    form.arm && `Arm ${form.arm} cm`,
    form.leg && `Leg ${form.leg} cm`,
    form.bodyFat && `Body fat ${form.bodyFat}%`,
  ].filter(Boolean) as string[];

  const insights = [
    stepsValue > 0
      ? stepsValue >= (userProfile.stepTarget ?? 10000)
        ? "You hit your daily steps target today."
        : `${(userProfile.stepTarget ?? 10000) - stepsValue} steps left to hit your target.`
      : "Steps are still empty today.",
    lastWeight
      ? weightDelta === null
        ? `${formatRelative(lastWeight.date)}. Add one more weigh-in to unlock a trend.`
        : weightDelta < 0
          ? `Latest weigh-in is down ${Math.abs(weightDelta).toFixed(1)} kg from the previous check-in.`
          : weightDelta > 0
            ? `Latest weigh-in is up ${weightDelta.toFixed(1)} kg from the previous check-in.`
            : "Your last two weigh-ins were the same."
      : "No weigh-ins yet. A weekly check-in is enough to get started.",
    measurementSummary.length > 0
      ? `Measurements are grouped in one place now so they feel like a check-in, not daily admin.`
      : "Measurements are optional here. Logging them every 2 to 4 weeks is enough.",
  ];

  return (
    <main className="mx-auto max-w-5xl p-4 pb-10">
      <div className="mb-6 rounded-[28px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.15),_transparent_35%),linear-gradient(180deg,_rgba(24,24,27,0.95),_rgba(9,9,11,0.95))] p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">Body hub</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Weekly check-ins, daily habits, clearer progress.</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              The page now separates what belongs today from what only matters every week or two.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2">
            <button onClick={() => changeDate(-1)} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700">
              Prev
            </button>
            <div className="min-w-[170px] text-center">
              <p className="text-sm text-zinc-300">{displayDate}</p>
              <p className="text-xs text-sky-300">{isToday ? "Today" : "Past entry"}</p>
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

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <StatusPill
          title="Next weigh-in"
          value={lastWeight?.weight ? `${lastWeight.weight} kg` : "No entry yet"}
          note={lastWeight ? formatRelative(lastWeight.date) : "Weekly is enough. No need to log this every day."}
          tone={weighInState}
        />
        <StatusPill
          title="Measurements"
          value={measurementSummary.length > 0 ? `${measurementSummary.length} metrics logged` : "Optional check-in"}
          note={lastMeasurement ? formatRelative(lastMeasurement.date) : "Best used every 2 to 4 weeks."}
          tone={measurementState}
        />
        <StatusPill
          title="Today"
          value={`${[form.steps, form.water, form.sleep].filter(Boolean).length}/3 habits logged`}
          note={stepsValue || waterValue || sleepValue ? "Quick habits stay lightweight here." : "Keep today simple: steps, water and sleep."}
          tone={stepsValue || waterValue || sleepValue ? "fresh" : "soon"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Progress</p>
              <h2 className="mt-1 text-xl font-semibold">Your body dashboard</h2>
            </div>
            {bmi && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
                <p className="text-xs text-zinc-500">BMI</p>
                <p className="text-2xl font-semibold">{bmi}</p>
                <p className="text-xs text-zinc-400">{bmiCategory}</p>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">Latest weight</p>
              <p className="mt-2 text-2xl font-semibold">{form.weight || lastWeight?.weight || "--"} <span className="text-base text-zinc-500">kg</span></p>
              <p className="mt-1 text-xs text-zinc-400">
                {weightDelta === null ? "Waiting for a second weigh-in" : `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg vs previous`}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">Steps today</p>
              <p className="mt-2 text-2xl font-semibold">{stepsValue ? stepsValue.toLocaleString() : "--"}</p>
              <p className="mt-1 text-xs text-zinc-400">{stepsValue ? `About ${caloriesBurned} kcal from walking` : "Add your daily movement here"}</p>
            </div>
            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">Latest measurement block</p>
              <p className="mt-2 text-lg font-semibold">{measurementSummary.length > 0 ? "Filled in" : "Still empty"}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {lastMeasurement ? lastMeasurement.date.slice(0, 10) : "Great for every few weeks, not every day."}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
            <WeightChart data={history} />
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Insights</p>
          <h2 className="mt-1 text-xl font-semibold">What deserves attention</h2>

          <div className="mt-4 space-y-3">
            {insights.map((insight) => (
              <div key={insight} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
                {insight}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-100">
            Recommended rhythm: daily habits here, weight once a week, measurements every 2 to 4 weeks.
          </div>
        </div>
      </div>

      <div className="mb-6 flex rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
        {(["today", "checkin", "progress"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab ? "bg-zinc-800 text-white" : "text-zinc-400"
            }`}
          >
            {tab === "today" ? "Today" : tab === "checkin" ? "Check-in" : "Progress"}
          </button>
        ))}
      </div>

      {activeTab === "today" && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Daily habits</p>
                <h2 className="mt-1 text-xl font-semibold">Keep this part fast.</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <MetricInput label="Steps" hint="Usually daily" value={form.steps} onChange={(value) => updateForm("steps", value)} />
                <MetricInput label="Water (L)" hint="Small daily check" value={form.water} step="0.1" onChange={(value) => updateForm("water", value)} />
                <MetricInput label="Sleep (h)" hint="Nightly recovery" value={form.sleep} step="0.5" onChange={(value) => updateForm("sleep", value)} />
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Today at a glance</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-sm text-zinc-400">Steps</p>
                  <ProgressBar value={stepsValue} target={userProfile.stepTarget ?? 10000} unit="steps" />
                </div>
                <div>
                  <p className="mb-2 text-sm text-zinc-400">Water</p>
                  <ProgressBar value={waterValue} target={userProfile.waterTarget ?? 2.5} unit="L" />
                </div>
                <div>
                  <p className="mb-2 text-sm text-zinc-400">Sleep</p>
                  <ProgressBar value={sleepValue} target={userProfile.sleepTarget ?? 8} unit="h" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Why this works</p>
            <h2 className="mt-1 text-xl font-semibold">Today only shows what belongs today.</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-400">
              <p>Weight and measurements are intentionally not leading this screen anymore.</p>
              <p>You can still log them, but the daily view stays light so it does not feel like admin work.</p>
              <p>If you later connect wearables, this area becomes even cleaner because it can turn into mostly passive data.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "checkin" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Weekly check-in</p>
                <h2 className="mt-1 text-xl font-semibold">Weight and composition updates.</h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs ${dueClasses(weighInState)}`}>
                {weighInState === "overdue" ? "Due now" : weighInState === "soon" ? "Coming up" : "Fresh"}
              </div>
            </div>

            <div className="space-y-4">
              <MetricInput label="Weight (kg)" hint="Weekly is enough for most people" value={form.weight} step="0.1" onChange={(value) => updateForm("weight", value)} />
              <MetricInput label="Body fat (%)" hint="Optional weekly or bi-weekly check" value={form.bodyFat} step="0.1" onChange={(value) => updateForm("bodyFat", value)} />
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Measurements</p>
                <h2 className="mt-1 text-xl font-semibold">Monthly or bi-weekly deep dive.</h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs ${dueClasses(measurementState)}`}>
                {measurementState === "overdue" ? "Due now" : measurementState === "soon" ? "Soon" : "Fresh"}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricInput label="Waist (cm)" hint="Core progress" value={form.waist} step="0.1" onChange={(value) => updateForm("waist", value)} />
              <MetricInput label="Chest (cm)" hint="Upper body" value={form.chest} step="0.1" onChange={(value) => updateForm("chest", value)} />
              <MetricInput label="Hip (cm)" hint="Lower body" value={form.hip} step="0.1" onChange={(value) => updateForm("hip", value)} />
              <MetricInput label="Arm (cm)" hint="Optional" value={form.arm} step="0.1" onChange={(value) => updateForm("arm", value)} />
              <MetricInput label="Leg (cm)" hint="Optional" value={form.leg} step="0.1" onChange={(value) => updateForm("leg", value)} />
            </div>
          </div>

          <div className="rounded-[28px] border border-sky-500/20 bg-sky-500/5 p-5 lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">AI check-in summary</p>
                <h2 className="mt-1 text-xl font-semibold">A short read on your latest numbers.</h2>
                <p className="mt-1 text-sm text-zinc-400">Runs only when you ask. Editing or autosaving a value never calls AI.</p>
              </div>
              <button
                onClick={() => void generateAiSummary()}
                disabled={aiLoading}
                className="shrink-0 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {aiLoading ? "Analyzing..." : aiSummary ? "Refresh summary" : "Analyze check-in"}
              </button>
            </div>

            {aiError && (
              <p className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200" aria-live="polite">
                {aiError}
              </p>
            )}

            {aiSummary && (
              <div className="mt-5 space-y-4" aria-live="polite">
                <p className="text-sm text-zinc-200">{aiSummary.summary}</p>

                <div className="grid gap-3 md:grid-cols-2">
                  {aiSummary.trends.length > 0 && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">What changed</p>
                      <div className="space-y-2">
                        {aiSummary.trends.map((item) => <p key={item} className="text-sm text-zinc-300">{item}</p>)}
                      </div>
                    </div>
                  )}

                  {aiSummary.focus.length > 0 && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400">Keep in focus</p>
                      <div className="space-y-2">
                        {aiSummary.focus.map((item) => <p key={item} className="text-sm text-zinc-300">{item}</p>)}
                      </div>
                    </div>
                  )}
                </div>

                {aiSummary.caution && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Worth rechecking</p>
                    <p className="mt-1 text-sm text-amber-100">{aiSummary.caution}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "progress" && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">History</p>
            <h2 className="mt-1 text-xl font-semibold">Timeline of body logs</h2>
            <div className="mt-4">
              <CalendarView history={history} stepTarget={userProfile.stepTarget ?? 10000} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Check-in summary</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500">Weight rhythm</p>
                  <p className="mt-1 text-sm text-zinc-300">{lastWeight ? formatRelative(lastWeight.date) : "No weigh-ins yet"}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500">Measurement rhythm</p>
                  <p className="mt-1 text-sm text-zinc-300">{lastMeasurement ? formatRelative(lastMeasurement.date) : "No measurement block yet"}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500">Current strategy</p>
                  <p className="mt-1 text-sm text-zinc-300">Track daily habits lightly. Use check-ins for everything that should not demand attention every day.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Coming next</p>
              <div className="mt-4 space-y-3 text-sm text-zinc-400">
                <p>This layout is ready for progress photos, comparison cards and smarter weekly insights later.</p>
                <p>We kept the existing data model, so we can add those upgrades without rebuilding the backend first.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {(saving || saved || saveError) && (
        <p
          className={`mt-4 text-right text-xs ${saveError ? "text-red-400" : saved ? "text-emerald-400" : "text-zinc-500"}`}
          aria-live="polite"
        >
          {saveError ? "Save failed" : saved ? "Saved" : "Saving..."}
        </p>
      )}
    </main>
  );
}

export default function BodyPage() {
  return (
    <Suspense fallback={<main className="p-4 text-zinc-400">Loading...</main>}>
      <BodyContent />
    </Suspense>
  );
}
