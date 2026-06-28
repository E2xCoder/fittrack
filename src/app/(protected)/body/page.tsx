"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface BodyLog {
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
  caloriesBurned?: number;
}

function toDateString(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

function ProgressBar({ value, target, color, unit }: {
  value: number; target: number; color: string; unit: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{value} {unit}</span>
        <span>/ {target} {unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WeightChart({ data }: { data: HistoryLog[] }) {
  const weights = data.filter(d => d.weight).map(d => ({ date: d.date, w: Number(d.weight) }));
  if (weights.length < 2) return (
    <p className="text-center text-xs text-zinc-500 py-4">Need at least 2 entries for chart</p>
  );

  const min = Math.min(...weights.map(w => w.w)) - 0.5;
  const max = Math.max(...weights.map(w => w.w)) + 0.5;
  const range = max - min || 1;
  const W = 300; const H = 80;

  const points = weights.map((w, i) => ({
    x: weights.length === 1 ? W / 2 : (i / (weights.length - 1)) * (W - 20) + 10,
    y: H - 10 - ((w.w - min) / range) * (H - 20),
    weight: w.w, date: w.date,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;
  const change = weights[weights.length - 1].w - weights[0].w;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{weights[0].w} → {weights[weights.length - 1].w} kg</span>
        <span className={`text-xs font-medium ${change < 0 ? "text-green-400" : change > 0 ? "text-rose-400" : "text-zinc-400"}`}>
          {change > 0 ? "+" : ""}{change.toFixed(1)} kg
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#wGrad)" />
        <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#22c55e" stroke="#000" strokeWidth="1" />
            <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="7" fill="#a1a1aa">{p.weight}</text>
          </g>
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
    history.forEach(log => { map[log.date.slice(0, 10)] = log; });
    return map;
  }, [history]);

  const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
  const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0
  const totalDays = lastDay.getDate();
  const today = toDateString(new Date());

  const monthName = firstDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function prevMonth() {
    setViewMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
    setSelectedDay(null);
  }

  function nextMonth() {
    const now = new Date();
    if (viewMonth.year === now.getFullYear() && viewMonth.month === now.getMonth()) return;
    setViewMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
    setSelectedDay(null);
  }

  const isCurrentMonth = viewMonth.year === new Date().getFullYear() && viewMonth.month === new Date().getMonth();

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">←</button>
        <p className="font-semibold">{monthName}</p>
        <button onClick={nextMonth} disabled={isCurrentMonth}
          className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700 disabled:opacity-30">→</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-xs text-zinc-600 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const log = historyMap[dateStr];
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          const hasSteps = log?.steps && Number(log.steps) > 0;
          const hitStepGoal = hasSteps && Number(log!.steps) >= stepTarget;
          const hasWeight = !!log?.weight;
          const isSelected = selectedDay?.date?.slice(0, 10) === dateStr;

          return (
            <button
              key={dateStr}
              onClick={() => !isFuture && setSelectedDay(isSelected ? null : (log ?? { date: dateStr }))}
              disabled={isFuture}
              className={`relative flex flex-col items-center justify-center rounded-xl py-2 transition ${
                isSelected ? "ring-2 ring-green-500 bg-zinc-800" :
                isToday ? "bg-green-900/40 ring-1 ring-green-700" :
                log ? "bg-zinc-800/60 hover:bg-zinc-800" :
                "hover:bg-zinc-900"
              } ${isFuture ? "opacity-20" : ""}`}
            >
              <span className={`text-xs font-medium ${isToday ? "text-green-400" : log ? "text-white" : "text-zinc-600"}`}>
                {day}
              </span>
              {/* Dots */}
              <div className="flex gap-0.5 mt-0.5">
                {hasSteps && (
                  <div className={`h-1 w-1 rounded-full ${hitStepGoal ? "bg-green-400" : "bg-purple-400"}`} />
                )}
                {hasWeight && (
                  <div className="h-1 w-1 rounded-full bg-blue-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-400" /><span>Steps goal hit</span></div>
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-purple-400" /><span>Steps logged</span></div>
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-400" /><span>Weight</span></div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
          <p className="mb-3 font-semibold">
            {new Date(selectedDay.date.slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long"
            })}
          </p>
          {!selectedDay.steps && !selectedDay.weight && !selectedDay.water && !selectedDay.sleep ? (
            <p className="text-sm text-zinc-500">No data logged</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {selectedDay.steps && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">👟 Steps</p>
                  <p className="text-lg font-bold">{Number(selectedDay.steps).toLocaleString()}</p>
                  {selectedDay.caloriesBurned && (
                    <p className="text-xs text-orange-400">🔥 {selectedDay.caloriesBurned} kcal</p>
                  )}
                </div>
              )}
              {selectedDay.weight && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">⚖️ Weight</p>
                  <p className="text-lg font-bold">{selectedDay.weight} kg</p>
                </div>
              )}
              {selectedDay.water && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">💧 Water</p>
                  <p className="text-lg font-bold">{selectedDay.water}L</p>
                </div>
              )}
              {selectedDay.sleep && (
                <div className="rounded-xl bg-zinc-800 p-3">
                  <p className="text-xs text-zinc-500">😴 Sleep</p>
                  <p className="text-lg font-bold">{selectedDay.sleep}h</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weight chart */}
      {history.filter(h => h.weight).length >= 2 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-semibold">⚖️ Weight trend</h2>
          <WeightChart data={history} />
        </div>
      )}
    </div>
  );
}

function BodyContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState(() => dateParam ?? toDateString(new Date()));
  const [bodyLog, setBodyLog] = useState<BodyLog>({});
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "measurements" | "history">("daily");

  const [form, setForm] = useState({
    weight: "", steps: "", water: "", sleep: "",
    waist: "", chest: "", hip: "", arm: "", leg: "", bodyFat: "",
  });

  async function fetchData(date: string) {
    const res = await fetch(`/api/body?date=${date}`);
    const data = await res.json();
    setUserProfile(data.userProfile ?? {});
    if (data.bodyLog) {
      setBodyLog(data.bodyLog);
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
      setBodyLog({});
      setForm({ weight: "", steps: "", water: "", sleep: "", waist: "", chest: "", hip: "", arm: "", leg: "", bodyFat: "" });
    }
    setHasChanges(false);
    setLoadedDate(date);
  }

  async function fetchHistory() {
    const res = await fetch("/api/body/history?days=90");
    const data = await res.json();
    setHistory(data);
  }

  useEffect(() => {
    fetchData(selectedDate);
    fetchHistory();
  }, [selectedDate]);

  useEffect(() => {
    if (!hasChanges || loadedDate !== selectedDate) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      setSaveError(false);
      try {
        const res = await fetch("/api/body", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, date: selectedDate }),
        });
        if (!res.ok) throw new Error("Body data could not be saved");
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

  function updateForm(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setHasChanges(true);
    setSaved(false);
    setSaveError(false);
  }

  function changeDate(offset: number) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(toDateString(d));
  }

  const isToday = selectedDate === toDateString(new Date());
  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  const bmi = userProfile.height && userProfile.weight
    ? (userProfile.weight / ((userProfile.height / 100) ** 2)).toFixed(1) : null;
  const bmiCategory = bmi
    ? Number(bmi) < 18.5 ? "Underweight"
    : Number(bmi) < 25 ? "Normal"
    : Number(bmi) < 30 ? "Overweight" : "Obese" : null;

  const steps = Number(form.steps) || 0;
  const caloriesBurned = Math.round(steps * 0.04 * ((userProfile.weight ?? 70) / 70));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Body Tracking</h1>
        <p className="text-sm text-zinc-400">Daily health metrics</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">← Prev</button>
        <div className="text-center">
          <p className="text-sm text-zinc-400">{displayDate}</p>
          {isToday && <span className="text-xs font-medium text-green-400">Today</span>}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-30">Next →</button>
      </div>

      {bmi && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">BMI</p>
              <p className="text-3xl font-bold">{bmi}</p>
              <p className={`text-sm ${bmiCategory === "Normal" ? "text-green-400" : bmiCategory === "Underweight" ? "text-blue-400" : "text-rose-400"}`}>
                {bmiCategory}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <p>{userProfile.height} cm</p>
              <p>{userProfile.weight} kg</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex rounded-xl bg-zinc-900 p-1">
        {(["daily", "measurements", "history"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${activeTab === tab ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>
            {tab === "daily" ? "Daily" : tab === "measurements" ? "Measurements" : "History"}
          </button>
        ))}
      </div>

      {activeTab === "daily" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">⚖️ Weight (kg)</label>
            <input type="number" step="0.1" placeholder="e.g. 75.5" value={form.weight}
              onChange={(e) => updateForm("weight", e.target.value)}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600" />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">👟 Steps</label>
            <input type="number" placeholder="e.g. 8000" value={form.steps}
              onChange={(e) => updateForm("steps", e.target.value)}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 mb-3" />
            {steps > 0 && (
              <>
                <ProgressBar value={steps} target={userProfile.stepTarget ?? 10000} color="bg-purple-500" unit="steps" />
                <p className="mt-2 text-xs text-zinc-500">~{caloriesBurned} kcal burned from steps</p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">💧 Water (L)</label>
            <input type="number" step="0.1" placeholder="e.g. 2.5" value={form.water}
              onChange={(e) => updateForm("water", e.target.value)}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 mb-3" />
            {form.water && (
              <ProgressBar value={Number(form.water)} target={userProfile.waterTarget ?? 2.5} color="bg-blue-500" unit="L" />
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">😴 Sleep (hours)</label>
            <input type="number" step="0.5" placeholder="e.g. 7.5" value={form.sleep}
              onChange={(e) => updateForm("sleep", e.target.value)}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 mb-3" />
            {form.sleep && (
              <ProgressBar value={Number(form.sleep)} target={userProfile.sleepTarget ?? 8} color="bg-indigo-500" unit="hrs" />
            )}
          </div>
        </div>
      )}

      {activeTab === "measurements" && (
        <div className="space-y-3">
          {[
            { key: "waist", label: "Waist", icon: "📏" },
            { key: "chest", label: "Chest", icon: "💪" },
            { key: "hip", label: "Hip", icon: "📐" },
            { key: "arm", label: "Arm", icon: "💪" },
            { key: "leg", label: "Leg", icon: "🦵" },
            { key: "bodyFat", label: "Body Fat", icon: "📊", unit: "%" },
          ].map(({ key, label, icon, unit }) => (
            <div key={key} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <label className="mb-2 block text-sm font-medium">{icon} {label} ({unit ?? "cm"})</label>
              <input type="number" step="0.1"
                placeholder={`e.g. ${key === "bodyFat" ? "15" : "80"}`}
                value={form[key as keyof typeof form]}
                onChange={(e) => updateForm(key as keyof typeof form, e.target.value)}
                className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <CalendarView history={history} stepTarget={userProfile.stepTarget ?? 10000} />
      )}

      {activeTab !== "history" && (saving || saved || saveError) && (
        <p className={`mt-4 text-right text-xs ${saveError ? "text-red-400" : saved ? "text-green-400" : "text-zinc-500"}`} aria-live="polite">
          {saveError ? "Save failed" : saved ? "Saved ✓" : "Saving..."}
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
