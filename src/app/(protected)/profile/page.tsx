"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: "",
    calorieTarget: "",
    proteinTarget: "",
    carbTarget: "",
    fatTarget: "",
    height: "",
    weight: "",
    stepTarget: "",
    waterTarget: "",
    sleepTarget: "",
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user/goals")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name ?? "",
          calorieTarget: data.calorieTarget ?? "",
          proteinTarget: data.proteinTarget ?? "",
          carbTarget: data.carbTarget ?? "",
          fatTarget: data.fatTarget ?? "",
          height: data.height ?? "",
          weight: data.weight ?? "",
          stepTarget: data.stepTarget ?? "10000",
          waterTarget: data.waterTarget ?? "2.5",
          sleepTarget: data.sleepTarget ?? "8",
        });
        setLoading(false);
      });
  }, []);

  async function save() {
    await fetch("/api/user/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <main className="p-6 text-zinc-400">Loading...</main>;

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-zinc-400">Set your targets and body info</p>
      </div>

      <div className="space-y-4">
        {/* Personal */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Personal Info</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                placeholder="Your name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="175"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="75"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Nutrition targets */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Nutrition Targets</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "calorieTarget", label: "Calories", placeholder: "2400", unit: "kcal" },
              { key: "proteinTarget", label: "Protein", placeholder: "150", unit: "g" },
              { key: "carbTarget", label: "Carbs", placeholder: "200", unit: "g" },
              { key: "fatTarget", label: "Fat", placeholder: "70", unit: "g" },
            ].map(({ key, label, placeholder, unit }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-zinc-400">{label} ({unit})</label>
                <input
                  type="number"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Daily targets */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Daily Targets</h2>
          <div className="space-y-3">
            {[
              { key: "stepTarget", label: "Step Goal", placeholder: "10000", unit: "steps" },
              { key: "waterTarget", label: "Water Goal", placeholder: "2.5", unit: "L" },
              { key: "sleepTarget", label: "Sleep Goal", placeholder: "8", unit: "hrs" },
            ].map(({ key, label, placeholder, unit }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-zinc-400">{label} ({unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-700"
        >
          {saved ? "Saved ✓" : "Save Profile"}
        </button>
      </div>
    </main>
  );
}