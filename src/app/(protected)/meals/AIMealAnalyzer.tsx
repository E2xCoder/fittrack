"use client";

import { useRef, useState } from "react";
import { posthog } from "@/lib/posthog";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AIItem {
  name: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AIResult {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: AIItem[];
}

interface Props {
  dateParam: string | null;
  onClose: () => void;
  onAdded: () => void;
}

// ─── Image helper ─────────────────────────────────────────────────────────────
// Phone photos are several MB; downscale to ≤1024px JPEG before sending so the
// payload (and OpenAI vision cost) stays small.

async function fileToResizedDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("decode failed"));
    img.src = dataUrl;
  });

  const maxDim = 1024;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function sumTotals(items: AIItem[]) {
  return {
    totalCalories: Math.round(items.reduce((s, it) => s + it.calories, 0)),
    totalProtein: Math.round(items.reduce((s, it) => s + it.protein, 0) * 10) / 10,
    totalCarbs: Math.round(items.reduce((s, it) => s + it.carbs, 0) * 10) / 10,
    totalFat: Math.round(items.reduce((s, it) => s + it.fat, 0) * 10) / 10,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIMealAnalyzer({ dateParam, onClose, onAdded }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState<null | "single" | "separate">(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError("");
    try {
      const resized = await fileToResizedDataUrl(file);
      setImage(resized);
    } catch {
      setError("Fotoğraf yüklenemedi, başka bir görsel deneyin.");
    }
  }

  async function analyze() {
    setError("");
    if (!image && !message.trim()) {
      setError("Lütfen bir açıklama yazın veya fotoğraf ekleyin.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    setEditing(false);
    try {
      const res = await fetch("/api/nutrition-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, message: message.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error ?? "Analiz başarısız oldu, tekrar deneyin.");
        return;
      }
      setResult(data as AIResult);
      posthog.capture("ai_meal_analyzed", {
        hasImage: !!image,
        itemCount: (data as AIResult).items?.length ?? 0,
      });
    } catch {
      setError("Bağlantı hatası. İnternet bağlantınızı kontrol edin.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(idx: number, field: keyof AIItem, value: string) {
    setResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => {
        if (i !== idx) return it;
        if (field === "name" || field === "unit") return { ...it, [field]: value };
        return { ...it, [field]: Number(value) || 0 };
      });
      return { ...prev, items, ...sumTotals(items) };
    });
  }

  function removeItem(idx: number) {
    setResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((_, i) => i !== idx);
      return { ...prev, items, ...sumTotals(items) };
    });
  }

  async function logMeal(mode: "single" | "separate") {
    if (!result || logging) return;
    setError("");
    setLogging(mode);
    try {
      if (mode === "single") {
        const res = await fetch("/api/log-meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "AI Meal Analysis",
            calories: result.totalCalories,
            protein: result.totalProtein,
            carbs: result.totalCarbs,
            fat: result.totalFat,
            quantity: 1,
            servingLabel: "porsiyon",
            servingSize: 1,
            date: dateParam,
          }),
        });
        if (!res.ok) throw new Error("log failed");
      } else {
        // Sequential to avoid a race on the daily-log unique [userId, date] row.
        for (const it of result.items) {
          const label = it.amount ? `${it.name} (${it.amount}${it.unit})` : it.name;
          const res = await fetch("/api/log-meal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: label,
              calories: it.calories,
              protein: it.protein,
              carbs: it.carbs,
              fat: it.fat,
              quantity: 1,
              servingLabel: it.unit || "porsiyon",
              servingSize: it.amount || 1,
              date: dateParam,
            }),
          });
          if (!res.ok) throw new Error("log failed");
        }
      }
      posthog.capture("ai_meal_logged", { mode, itemCount: result.items.length });
      onAdded();
      onClose();
    } catch {
      setError("Loglama başarısız oldu, tekrar deneyin.");
      setLogging(null);
    }
  }

  const macroChips = result
    ? [
        { label: "kcal", value: result.totalCalories, color: "bg-zinc-800 text-white" },
        { label: "P", value: result.totalProtein, color: "bg-blue-950 text-blue-300" },
        { label: "K", value: result.totalCarbs, color: "bg-amber-950 text-amber-300" },
        { label: "Y", value: result.totalFat, color: "bg-rose-950 text-rose-300" },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 sm:items-center sm:justify-center sm:bg-black/70 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col bg-zinc-950 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl sm:border sm:border-zinc-700 sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-base font-black leading-tight text-white">🍽️ AI ile Analiz</h2>
            <p className="text-[11px] text-zinc-500">GPT-4o · fotoğraf + açıklama</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-safe">
          {/* Hidden file inputs */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />

          {/* Photo area */}
          {image ? (
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Yemek" className="max-h-64 w-full object-contain bg-black" />
              <button
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-red-600"
                title="Fotoğrafı sil"
              >
                🗑
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 py-5 text-sm font-semibold text-zinc-300 transition-colors hover:border-green-600 hover:text-green-400"
              >
                <span className="text-2xl">📷</span>
                Kameradan Çek
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 py-5 text-sm font-semibold text-zinc-300 transition-colors hover:border-green-600 hover:text-green-400"
              >
                <span className="text-2xl">🖼️</span>
                Galeriden Seç
              </button>
            </div>
          )}

          {/* Message input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Örn: 100gr pilav, 120gr tavuk göğsü, 1 yemek kaşığı zeytinyağı"
            className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-green-600"
          />

          {/* Analyze button */}
          <button
            onClick={analyze}
            disabled={analyzing}
            className="w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {analyzing ? "GPT-4o analiz ediyor... 🤔" : "✨ Analiz Et"}
          </button>

          {error && (
            <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              {/* Totals */}
              <div className="rounded-2xl border border-green-900/40 bg-green-950/20 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-green-600">
                  Toplam
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-green-400">{result.totalCalories}</span>
                  <span className="mb-1 text-sm text-zinc-500">kcal</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {macroChips.slice(1).map((m) => (
                    <span
                      key={m.label}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.color}`}
                    >
                      {m.label} {m.value}g
                    </span>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-400">
                  {result.items.length} yemek
                </p>
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-lg bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  {editing ? "✓ Bitti" : "✏ Düzenle"}
                </button>
              </div>

              <div className="space-y-2">
                {result.items.map((it, idx) =>
                  editing ? (
                    <div key={idx} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex gap-2">
                        <input
                          value={it.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          className="flex-1 rounded-lg bg-zinc-800 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-green-700"
                        />
                        <button
                          onClick={() => removeItem(idx)}
                          className="rounded-lg bg-zinc-800 px-2 text-sm text-zinc-500 transition-colors hover:bg-red-900 hover:text-red-300"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1">
                          <span className="text-[10px] text-zinc-500">Miktar</span>
                          <input
                            type="number"
                            value={it.amount}
                            onChange={(e) => updateItem(idx, "amount", e.target.value)}
                            className="w-full bg-transparent text-right text-sm text-white outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1">
                          <span className="text-[10px] text-zinc-500">Birim</span>
                          <input
                            value={it.unit}
                            onChange={(e) => updateItem(idx, "unit", e.target.value)}
                            className="w-full bg-transparent text-right text-sm text-white outline-none"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["calories", "protein", "carbs", "fat"] as const).map((f) => (
                          <label key={f} className="rounded-lg bg-zinc-800 px-1.5 py-1 text-center">
                            <span className="block text-[9px] uppercase text-zinc-500">
                              {f === "calories" ? "kcal" : f === "protein" ? "P" : f === "carbs" ? "K" : "Y"}
                            </span>
                            <input
                              type="number"
                              value={it[f]}
                              onChange={(e) => updateItem(idx, f, e.target.value)}
                              className="w-full bg-transparent text-center text-sm text-white outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {it.name}
                          {it.amount ? (
                            <span className="ml-1 text-xs font-normal text-zinc-500">
                              {it.amount}{it.unit}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          P:{it.protein}g · K:{it.carbs}g · Y:{it.fat}g
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-sm font-bold text-green-400">
                        {it.calories} kcal
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* Log actions */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => logMeal("single")}
                  disabled={logging !== null || result.items.length === 0}
                  className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
                >
                  {logging === "single" ? "Ekleniyor…" : "✓ Onayla ve Tek Log Ekle"}
                </button>
                <button
                  onClick={() => logMeal("separate")}
                  disabled={logging !== null || result.items.length === 0}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-green-600 hover:text-green-400 disabled:opacity-50"
                >
                  {logging === "separate" ? "Ekleniyor…" : "📋 Her Yemeği Ayrı Logla"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
