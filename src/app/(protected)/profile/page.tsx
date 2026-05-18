"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: "",
    calorieTarget: "",
    proteinTarget: "",
    carbTarget: "",
    fatTarget: "",
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
        <p className="text-sm text-zinc-400">Set your daily targets</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
            placeholder="Your name"
          />
        </div>

        {[
          { key: "calorieTarget", label: "Daily Calories", placeholder: "2400", unit: "kcal" },
          { key: "proteinTarget", label: "Protein Target", placeholder: "150", unit: "g" },
          { key: "carbTarget", label: "Carb Target", placeholder: "200", unit: "g" },
          { key: "fatTarget", label: "Fat Target", placeholder: "70", unit: "g" },
        ].map(({ key, label, placeholder, unit }) => (
          <div key={key}>
            <label className="mb-1 block text-xs text-zinc-400">
              {label} ({unit})
            </label>
            <input
              type="number"
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
              placeholder={placeholder}
            />
          </div>
        ))}

        <button
          onClick={save}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-700"
        >
          {saved ? "Saved ✓" : "Save Targets"}
        </button>
      </div>
    </main>
  );
}