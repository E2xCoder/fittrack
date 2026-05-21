"use client";

import { useEffect, useState } from "react";

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

export default function BodyPage() {
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [bodyLog, setBodyLog] = useState<BodyLog>({});
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "measurements" | "history">("daily");

  const [form, setForm] = useState({
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
      setForm({
        weight: "", steps: "", water: "", sleep: "",
        waist: "", chest: "", hip: "", arm: "", leg: "", bodyFat: "",
      });
    }
  }

  async function fetchHistory() {
    const res = await fetch("/api/body/history?days=30");
    const data = await res.json();
    setHistory(data);
  }

  useEffect(() => {
    fetchData(selectedDate);
    fetchHistory();
  }, [selectedDate]);

  async function save() {
    setSaving(true);
    await fetch("/api/body", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date: selectedDate }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData(selectedDate);
    fetchHistory();
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

  // BMI calculation
  const bmi = userProfile.height && userProfile.weight
    ? (userProfile.weight / ((userProfile.height / 100) ** 2)).toFixed(1)
    : null;

  const bmiCategory = bmi
    ? Number(bmi) < 18.5 ? "Underweight"
    : Number(bmi) < 25 ? "Normal"
    : Number(bmi) < 30 ? "Overweight"
    : "Obese"
    : null;

  const steps = Number(form.steps) || 0;
  const caloriesBurned = Math.round(steps * 0.04 * ((userProfile.weight ?? 70) / 70));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Body Tracking</h1>
        <p className="text-sm text-zinc-400">Daily health metrics</p>
      </div>

      {/* Date navigator */}
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

      {/* BMI card */}
      {bmi && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">BMI</p>
              <p className="text-3xl font-bold">{bmi}</p>
              <p className={`text-sm ${
                bmiCategory === "Normal" ? "text-green-400"
                : bmiCategory === "Underweight" ? "text-blue-400"
                : "text-rose-400"
              }`}>{bmiCategory}</p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <p>{userProfile.height} cm</p>
              <p>{userProfile.weight} kg</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex rounded-xl bg-zinc-900 p-1">
        {(["daily", "measurements", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
              activeTab === tab ? "bg-zinc-700 text-white" : "text-zinc-400"
            }`}
          >
            {tab === "daily" ? "Daily" : tab === "measurements" ? "Measurements" : "History"}
          </button>
        ))}
      </div>

      {activeTab === "daily" && (
        <div className="space-y-4">
          {/* Weight */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">⚖️ Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 75.5"
              value={form.weight}
              onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          {/* Steps */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">👟 Steps</label>
            <input
              type="number"
              placeholder="e.g. 8000"
              value={form.steps}
              onChange={(e) => setForm((p) => ({ ...p, steps: e.target.value }))}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 mb-3"
            />
            {steps > 0 && (
              <>
                <ProgressBar
                  value={steps}
                  target={userProfile.stepTarget ?? 10000}
                  color="bg-purple-500"
                  unit="steps"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  ~{caloriesBurned} kcal burned from steps
                </p>
              </>
            )}
          </div>

          {/* Water */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">💧 Water (L)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 2.5"
              value={form.water}
              onChange={(e) => setForm((p) => ({ ...p, water: e.target.value }))}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 mb-3"
            />
            {form.water && (
              <ProgressBar
                value={Number(form.water)}
                target={userProfile.waterTarget ?? 2.5}
                color="bg-blue-500"
                unit="L"
              />
            )}
          </div>

          {/* Sleep */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-2 block text-sm font-medium">😴 Sleep (hours)</label>
            <input
              type="number"
              step="0.5"
              placeholder="e.g. 7.5"
              value={form.sleep}
              onChange={(e) => setForm((p) => ({ ...p, sleep: e.target.value }))}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 mb-3"
            />
            {form.sleep && (
              <ProgressBar
                value={Number(form.sleep)}
                target={userProfile.sleepTarget ?? 8}
                color="bg-indigo-500"
                unit="hrs"
              />
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
              <label className="mb-2 block text-sm font-medium">
                {icon} {label} ({unit ?? "cm"})
              </label>
              <input
                type="number"
                step="0.1"
                placeholder={`e.g. ${key === "bodyFat" ? "15" : "80"}`}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-sm text-zinc-500">No history yet. Start logging daily!</p>
          ) : (
            history.slice().reverse().map((log, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {new Date(log.date).toLocaleDateString("en-GB", {
                      weekday: "short", day: "numeric", month: "short"
                    })}
                  </p>
                  {log.weight && (
                    <span className="text-sm font-bold text-green-400">{log.weight} kg</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                  {log.steps && <span>👟 {log.steps.toLocaleString()} steps</span>}
                  {log.caloriesBurned && <span>🔥 {log.caloriesBurned} kcal burned</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab !== "history" && (
        <button
          onClick={save}
          disabled={saving}
          className={`mt-6 w-full rounded-xl py-3 font-semibold transition ${
            saved ? "bg-green-800 text-green-300" : "bg-green-600 hover:bg-green-700"
          } disabled:opacity-50`}
        >
          {saved ? "Saved ✓" : saving ? "Saving..." : "Save"}
        </button>
      )}
    </main>
  );
}