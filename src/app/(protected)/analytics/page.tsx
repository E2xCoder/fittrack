"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { METRICS, SEMANTIC } from "@/lib/metrics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  water: number;
  sleep: number;
  weight: number | null;
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
  avgSteps: number;
  deficitDays: number;
  surplusDays: number;
  proteinHitDays: number;
  gymDays: number;
  loggedDays: number;
  calorieAchievementRate: number;
  proteinAchievementRate: number;
  loggingRate: number;
  gymFrequency: number;
  currentStreak: number;
  longestStreak: number;
  consistencyScore: number;
}

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface WoW {
  calories: number | null;
  protein: number | null;
  steps: number | null;
}

interface AnalyticsData {
  goals: Goals;
  days: DayData[];
  period: number;
  summary: Summary;
  wow: WoW;
  verdicts: string[];
}

const CAL = METRICS.calories.hex;
const PRO = METRICS.protein.hex;
const CARB = METRICS.carbs.hex;
const FAT = METRICS.fat.hex;
const STEPS = METRICS.steps.hex;
const WATER = METRICS.water.hex;
const SLEEP = METRICS.sleep.hex;

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 shadow-xl backdrop-blur">
      <p className="mb-2 text-xs font-semibold text-zinc-300">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{Math.round(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Ring Progress ────────────────────────────────────────────────────────────

function RingProgress({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

// ─── Macro Bar ────────────────────────────────────────────────────────────────

function MacroBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 110);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── Delta chip (week-over-week) ───────────────────────────────────────────────

function WoWChip({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null || pct === 0) return <span className="text-[10px] text-zinc-600">— vs last week</span>;
  // invert = true means "up is bad" (e.g. calories over target isn't inherently good)
  const good = invert ? pct < 0 : pct > 0;
  return (
    <span className="text-[10px] font-semibold" style={{ color: good ? SEMANTIC.success : SEMANTIC.warning }}>
      {pct > 0 ? "↑" : "↓"}{Math.abs(pct)}% vs last week
    </span>
  );
}

// ─── Period / Tab buttons ──────────────────────────────────────────────────────

function PeriodBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
        active ? "bg-green-500 text-black shadow-lg shadow-green-500/30" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-200 ${
        active ? "border-b-2 border-green-500 text-green-400" : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, unit, sub, accent, rate, wow, wowInvert,
}: {
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  accent: string;
  rate?: number;
  wow?: number | null;
  wowInvert?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-4" style={{ boxShadow: `0 0 30px -10px ${accent}30` }}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }} />
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-black tabular-nums" style={{ color: accent }}>
        {typeof value === "number" ? Math.round(value) : value}
        {unit && <span className="ml-1 text-sm font-normal text-zinc-500">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
      {wow !== undefined && <div className="mt-1"><WoWChip pct={wow} invert={wowInvert} /></div>}
      {rate !== undefined && (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-zinc-500">achievement</span>
            <span style={{ color: accent }}>{rate}%</span>
          </div>
          <MacroBar value={rate} target={100} color={accent} />
        </div>
      )}
    </div>
  );
}

// ─── AI Insights (verdicts) ────────────────────────────────────────────────────

function AiInsights({ verdicts }: { verdicts: string[] }) {
  return (
    <div className="rounded-2xl border border-green-900/40 bg-gradient-to-br from-green-950/30 to-zinc-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <h3 className="text-sm font-bold text-zinc-200">AI Insights</h3>
      </div>
      <div className="space-y-2">
        {verdicts.map((v, i) => (
          <p key={i} className="rounded-lg bg-zinc-800/60 px-3 py-2 text-xs leading-relaxed text-zinc-300">{v}</p>
        ))}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AnalyticsData }) {
  const { summary, goals, verdicts, wow } = data;

  const achievements = [
    { label: "Calorie Goal", rate: summary.calorieAchievementRate, color: CAL, icon: "🔥", sub: `${summary.deficitDays}/${summary.loggedDays} deficit days` },
    { label: "Protein Goal", rate: summary.proteinAchievementRate, color: PRO, icon: "💪", sub: `${summary.proteinHitDays}/${summary.loggedDays} days hit` },
    { label: "Consistency", rate: summary.consistencyScore, color: STEPS, icon: "📊", sub: `${summary.loggedDays}/${data.period} days tracked` },
  ];

  return (
    <div className="space-y-5">
      {/* AI Insights — moved to top (most valuable) */}
      <AiInsights verdicts={verdicts} />

      {/* Streak card */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-900/40 bg-gradient-to-br from-orange-950/40 to-zinc-900 p-4" style={{ boxShadow: `0 0 40px -12px ${CAL}40` }}>
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${CAL}, transparent 70%)` }} />
        {summary.currentStreak === 0 ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-orange-300">Start a new streak today! 🔥</p>
              <p className="mt-1 text-xs text-zinc-500">Log a meal, workout or weigh-in to begin.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Best</p>
              <p className="text-3xl font-black text-zinc-300 tabular-nums">{summary.longestStreak}</p>
              <p className="text-xs text-zinc-600">days</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-orange-600">Current Streak</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-black tabular-nums" style={{ color: CAL }}>{summary.currentStreak}</p>
                <p className="mb-1 text-sm text-orange-600">days 🔥</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Best streak</p>
              <p className="text-3xl font-black text-zinc-300 tabular-nums">{summary.longestStreak}</p>
              <p className="text-xs text-zinc-600">days all-time</p>
            </div>
          </div>
        )}
        {summary.currentStreak > 0 && summary.currentStreak >= summary.longestStreak && (
          <p className="mt-3 text-xs font-semibold text-orange-400">🏆 This is your longest streak ever!</p>
        )}
      </div>

      {/* Achievement rings */}
      <div className="grid grid-cols-3 gap-3">
        {achievements.map((a) => (
          <div key={a.label} className="flex flex-col items-center rounded-2xl border border-zinc-800 bg-zinc-900 p-4" style={{ boxShadow: `0 0 30px -10px ${a.color}30` }}>
            <div className="relative flex items-center justify-center">
              <RingProgress value={a.rate} color={a.color} size={72} />
              <span className="absolute text-xl">{a.icon}</span>
            </div>
            <p className="mt-2 text-center text-xs font-bold tabular-nums" style={{ color: a.color }}>{a.rate}%</p>
            <p className="text-center text-xs text-zinc-500">{a.label}</p>
            <p className="mt-0.5 text-center text-[10px] text-zinc-600">{a.sub}</p>
          </div>
        ))}
      </div>

      {/* Key stats with week-over-week deltas */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Avg Calories" value={summary.avgCalories} unit="kcal" sub={`target: ${goals.calories} kcal`} accent={CAL} wow={wow.calories} wowInvert />
        <StatCard label="Avg Protein" value={summary.avgProtein} unit="g" sub={`target: ${goals.protein}g`} accent={PRO} wow={wow.protein} />
        <StatCard label="Gym Sessions" value={summary.gymDays} unit="sessions" sub={`${data.period} day period`} accent={FAT} />
        <StatCard label="Avg Steps" value={summary.avgSteps > 0 ? summary.avgSteps.toLocaleString() : "—"} sub="daily average" accent={STEPS} wow={wow.steps} />
      </div>
    </div>
  );
}

// ─── Nutrition Tab ────────────────────────────────────────────────────────────

function NutritionTab({ data }: { data: AnalyticsData }) {
  const { summary, goals, days } = data;

  const macros = [
    { label: "Calories", avg: summary.avgCalories, target: goals.calories, unit: "kcal", color: CAL, rate: summary.calorieAchievementRate },
    { label: "Protein", avg: summary.avgProtein, target: goals.protein, unit: "g", color: PRO, rate: summary.proteinAchievementRate },
    { label: "Carbs", avg: summary.avgCarbs, target: goals.carbs, unit: "g", color: CARB, rate: Math.round((summary.avgCarbs / goals.carbs) * 100) },
    { label: "Fat", avg: summary.avgFat, target: goals.fat, unit: "g", color: FAT, rate: Math.round((summary.avgFat / goals.fat) * 100) },
  ];

  const totalMacroKcal = summary.avgProtein * 4 + summary.avgCarbs * 4 + summary.avgFat * 9;
  const ratios = totalMacroKcal > 0
    ? [
        { label: "Protein", pct: Math.round((summary.avgProtein * 4 / totalMacroKcal) * 100), color: PRO },
        { label: "Carbs", pct: Math.round((summary.avgCarbs * 4 / totalMacroKcal) * 100), color: CARB },
        { label: "Fat", pct: Math.round((summary.avgFat * 9 / totalMacroKcal) * 100), color: FAT },
      ]
    : [];

  const chartData = days.filter((d) => d.logged).map((d) => ({
    label: d.label, calories: d.calories, protein: d.protein, deficit: d.deficit,
  }));

  const tick = { fontSize: 10, fill: "#71717a" };

  return (
    <div className="space-y-5">
      {/* Calorie trend line */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-1 text-sm font-bold text-zinc-300">Calories</h3>
          <p className="mb-4 text-xs text-zinc-500">daily intake vs target</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={goals.calories} stroke={CAL} strokeDasharray="4 4" strokeOpacity={0.6} />
              <Line type="monotone" dataKey="calories" name="Calories (kcal)" stroke={CAL} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Protein trend line */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-1 text-sm font-bold text-zinc-300">Protein</h3>
          <p className="mb-4 text-xs text-zinc-500">daily protein vs target</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={goals.protein} stroke={PRO} strokeDasharray="4 4" strokeOpacity={0.6} />
              <Line type="monotone" dataKey="protein" name="Protein (g)" stroke={PRO} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Macro cards */}
      {macros.map((m) => (
        <div key={m.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4" style={{ boxShadow: `0 0 20px -8px ${m.color}25` }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</span>
            <div className="text-right">
              <span className="text-lg font-black tabular-nums" style={{ color: m.color }}>{Math.round(m.avg)}</span>
              <span className="ml-1 text-xs text-zinc-500">{m.unit}</span>
              <span className="ml-2 text-xs text-zinc-600">/ {m.target}{m.unit}</span>
            </div>
          </div>
          <MacroBar value={m.avg} target={m.target} color={m.color} />
          <div className="mt-2 flex justify-between text-xs text-zinc-500">
            <span>{m.avg > m.target ? `+${Math.round(m.avg - m.target)} over` : `${Math.round(m.target - m.avg)} under target`}</span>
            <span style={{ color: m.color }}>{Math.min(m.rate, 110)}% of goal</span>
          </div>
        </div>
      ))}

      {/* Macro split */}
      {ratios.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-bold text-zinc-300">Macro Split</h3>
          <div className="flex gap-3">
            {ratios.map((r) => (
              <div key={r.label} className="flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span style={{ color: r.color }}>{r.label}</span>
                  <span className="text-zinc-400">{r.pct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deficit / surplus bars */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-1 text-sm font-bold text-zinc-300">Calorie Deficit / Surplus</h3>
          <p className="mb-4 text-xs text-zinc-500">green = deficit (on target) · red = surplus</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#52525b" />
              <Bar dataKey="deficit" name="Deficit (kcal)" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.deficit >= 0 ? SEMANTIC.success : SEMANTIC.danger} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deficit/Surplus counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-green-900/40 bg-green-950/20 p-4">
          <p className="text-xs text-green-600">Deficit Days</p>
          <p className="text-3xl font-black tabular-nums text-green-400">{summary.deficitDays}</p>
          <p className="text-xs text-zinc-600">under calorie goal</p>
        </div>
        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4">
          <p className="text-xs text-rose-600">Surplus Days</p>
          <p className="text-3xl font-black tabular-nums text-rose-400">{summary.surplusDays}</p>
          <p className="text-xs text-zinc-600">over calorie goal</p>
        </div>
      </div>
    </div>
  );
}

// ─── Trends Tab ───────────────────────────────────────────────────────────────

function TrendChart({
  title, subtitle, data, dataKey, color, targetLine, height = 180,
}: {
  title: string;
  subtitle: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  dataKey: string;
  color: string;
  targetLine?: number;
  height?: number;
}) {
  const gradId = `grad-${dataKey}`;
  const tick = { fontSize: 10, fill: "#71717a" };
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-1 text-sm font-bold text-zinc-300">{title}</h3>
      <p className="mb-4 text-xs text-zinc-500">{subtitle}</p>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={tick} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
          <Tooltip content={<CustomTooltip />} />
          {targetLine !== undefined && <ReferenceLine y={targetLine} stroke={color} strokeDasharray="4 4" strokeOpacity={0.4} />}
          <Area type="monotone" dataKey={dataKey} name={title} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendsTab({ data }: { data: AnalyticsData }) {
  const logged = data.days.filter((d) => d.logged);

  if (logged.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-500">
        No logged data in this period
      </div>
    );
  }

  const base = logged.map((d) => ({ label: d.label, calories: d.calories, protein: d.protein, steps: d.steps, water: d.water, sleep: d.sleep, weight: d.weight }));
  const weightData = base.filter((d) => d.weight != null);
  const stepsData = base.filter((d) => d.steps > 0);
  const waterData = base.filter((d) => d.water > 0);
  const sleepData = base.filter((d) => d.sleep > 0);

  return (
    <div className="space-y-5">
      <TrendChart title="Calories" subtitle="daily intake" data={base} dataKey="calories" color={CAL} targetLine={data.goals.calories} height={200} />
      {weightData.length >= 2 && (
        <TrendChart title="Weight" subtitle="body weight over time" data={weightData} dataKey="weight" color={PRO} />
      )}
      {stepsData.length > 0 && (
        <TrendChart title="Steps" subtitle="daily step count" data={stepsData} dataKey="steps" color={STEPS} targetLine={10000} />
      )}
      {waterData.length > 0 && (
        <TrendChart title="Water" subtitle="daily hydration (L)" data={waterData} dataKey="water" color={WATER} targetLine={2.5} />
      )}
      {sleepData.length > 0 && (
        <TrendChart title="Sleep" subtitle="nightly sleep (h)" data={sleepData} dataKey="sleep" color={SLEEP} targetLine={8} />
      )}
      {weightData.length < 2 && stepsData.length === 0 && waterData.length === 0 && sleepData.length === 0 && (
        <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
          Log steps, water, sleep or weight in the Body tab to unlock more trends here.
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Period = 7 | 30 | 365;
type Tab = "overview" | "nutrition" | "trends";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(7);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p: Period) => {
    setLoading(true);
    fetch(`/api/analytics?days=${p}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    queueMicrotask(() => load(period));
  }, [period, load]);

  const periodLabel = period === 7 ? "Last 7 days" : period === 30 ? "Last 30 days" : "Last year";

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-green-400/80">Analiz</p>
          <h1 className="text-2xl font-black tracking-tight text-white">Stats</h1>
          <p className="text-xs text-zinc-500">{periodLabel}</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {([7, 30, 365] as Period[]).map((p) => (
            <PeriodBtn key={p} label={p === 365 ? "1Y" : `${p}D`} active={period === p} onClick={() => setPeriod(p)} />
          ))}
        </div>
      </div>

      <div className="mb-5 flex border-b border-zinc-800">
        <TabBtn label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
        <TabBtn label="Nutrition" active={tab === "nutrition"} onClick={() => setTab("nutrition")} />
        <TabBtn label="Trends" active={tab === "trends"} onClick={() => setTab("trends")} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      ) : !data ? (
        <div className="py-20 text-center text-zinc-500">Failed to load stats</div>
      ) : (
        <>
          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "nutrition" && <NutritionTab data={data} />}
          {tab === "trends" && <TrendsTab data={data} />}
        </>
      )}
    </main>
  );
}
