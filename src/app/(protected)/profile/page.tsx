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
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

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

    fetch("/api/user/token")
      .then((r) => r.json())
      .then((data) => setApiToken(data.token));
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

  async function generateToken() {
    setGeneratingToken(true);
    const res = await fetch("/api/user/token", { method: "POST" });
    const data = await res.json();
    setApiToken(data.token);
    setGeneratingToken(false);
  }

  async function copyToken() {
    if (!apiToken) return;
    await navigator.clipboard.writeText(apiToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
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
              <input value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                placeholder="Your name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input type="number" value={form.height}
                  onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="175" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input type="number" step="0.1" value={form.weight}
                  onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="75" />
              </div>
            </div>
          </div>
        </div>

        {/* Nutrition */}
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
                <input type="number" value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder={placeholder} />
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
                <input type="number" step="0.1" value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={save}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-700">
          {saved ? "Saved ✓" : "Save Profile"}
        </button>

        {/* API Token */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-300">📱 iPhone Steps Sync</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Auto-sync your steps from iPhone Health every 3 hours
          </p>

          {apiToken ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-800 p-3">
                <p className="mb-1 text-xs text-zinc-500">Your API Token</p>
                <p className="break-all font-mono text-xs text-zinc-300">{apiToken}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyToken}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                    tokenCopied ? "bg-green-800 text-green-300" : "bg-zinc-800 hover:bg-zinc-700"
                  }`}>
                  {tokenCopied ? "Copied ✓" : "Copy Token"}
                </button>
                <button onClick={generateToken} disabled={generatingToken}
                  className="rounded-xl bg-zinc-800 px-4 text-sm hover:bg-zinc-700 disabled:opacity-50">
                  Refresh
                </button>
              </div>
              <div className="rounded-xl bg-zinc-800/50 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">Setup Instructions:</p>
                <ol className="space-y-1 text-xs text-zinc-500">
                  <li>1. Copy your token above</li>
                  <li>2. Open iPhone Shortcuts app</li>
                  <li>3. Create new shortcut with automation</li>
                  <li>4. Set trigger: Time of Day, every 3 hours</li>
                  <li>5. Add action: Get Health Sample (Steps)</li>
                  <li>6. Add action: Get Contents of URL</li>
                  <li>7. URL: <span className="text-zinc-300 break-all">https://fittrack-ten-umber.vercel.app/api/sync/steps</span></li>
                  <li>8. Method: POST, Body: JSON</li>
                  <li>9. Add header: Authorization: Bearer YOUR_TOKEN</li>
                  <li>10. Body: {`{"steps": [Health Sample Value]}`}</li>
                </ol>
              </div>
            </div>
          ) : (
            <button onClick={generateToken} disabled={generatingToken}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {generatingToken ? "Generating..." : "Generate API Token"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}