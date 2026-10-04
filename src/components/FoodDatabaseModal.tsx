"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { posthog } from "@/lib/posthog";
import MealTypePicker from "@/components/MealTypePicker";
import { defaultMealType, type MealType } from "@/lib/meal-type";
import { fileToResizedDataUrl } from "@/lib/image";

// Label scanning calls a paid vision model, so it follows the same flag as the other AI features.
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OFFProduct {
  code: string;
  product_name: string;
  brands?: string;
  image_thumb_url?: string;
  servingLabel?: string;
  nutriments: {
    "energy-kcal_100g"?: number;
    "proteins_100g"?: number;
    "carbohydrates_100g"?: number;
    "fat_100g"?: number;
  };
}

type FoodSource = "OFF" | "USDA" | "LABEL" | "HISTORY";
type Unit = "g" | "ml" | "piece";

interface NormalizedProduct {
  code: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  per100: { calories: number; protein: number; carbs: number; fat: number };
  source: FoodSource;
  servingLabel: "g" | "ml";
  /** Set for foods from the history list: how it was last logged. For "piece" the
   *  per100 values are per piece. */
  recent?: { unit: Unit; amount: number };
}

interface QueuedItem {
  product: NormalizedProduct;
  amount: number; // in `unit`
  unit: Unit;
}

interface HistoryApiItem {
  key: string;
  name: string;
  perUnit: { calories: number; protein: number; carbs: number; fat: number };
  unit: Unit;
  lastAmount: number;
  imageUrl: string | null;
}

// 1 piece vs. 100 g/ml — per100 holds the values for that base amount.
const unitMult = (unit: Unit, amount: number) => (unit === "piece" ? amount : amount / 100);
const unitText = (unit: Unit) => (unit === "piece" ? "adet" : unit);

function fromHistory(h: HistoryApiItem): NormalizedProduct {
  const k = h.unit === "piece" ? 1 : 100;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    code: `hist:${h.key}`,
    name: h.name,
    brand: "",
    imageUrl: h.imageUrl,
    source: "HISTORY",
    servingLabel: h.unit === "ml" ? "ml" : "g",
    per100: {
      calories: Math.round(h.perUnit.calories * k),
      protein: r1(h.perUnit.protein * k),
      carbs: r1(h.perUnit.carbs * k),
      fat: r1(h.perUnit.fat * k),
    },
    recent: { unit: h.unit, amount: h.lastAmount },
  };
}

const foodLabel = (p: NormalizedProduct) => p.name + (p.brand ? ` (${p.brand})` : "");

interface Props {
  onClose: () => void;
  dateParam: string | null;
  onAdded: () => void; // refresh parent meal list
  initialTab?: "search" | "barcode" | "label";
  initialMealType?: MealType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(p: OFFProduct & { source?: FoodSource }): NormalizedProduct | null {
  const name = p.product_name?.trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  return {
    code: p.code,
    name,
    brand: p.brands?.split(",")[0]?.trim() ?? "",
    imageUrl: p.image_thumb_url ?? null,
    source: p.source ?? "OFF",
    servingLabel: p.servingLabel === "ml" ? "ml" : "g",
    per100: {
      calories: Math.round(n["energy-kcal_100g"] ?? 0),
      protein:  Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
      carbs:    Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
      fat:      Math.round((n["fat_100g"] ?? 0) * 10) / 10,
    },
  };
}

// ─── Macro Badge ──────────────────────────────────────────────────────────────

function MacroBadge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {label} {value}{unit}
    </span>
  );
}

// ─── Add Quantity Modal ───────────────────────────────────────────────────────

function AddQuantityModal({
  product,
  dateParam,
  onDone,
  onCancel,
  defaultMeal,
}: {
  product: NormalizedProduct;
  dateParam: string | null;
  onDone: () => void;
  onCancel: () => void;
  defaultMeal?: MealType;
}) {
  const [amount, setAmount] = useState(product.recent ? String(product.recent.amount) : "100");
  const [unit, setUnit] = useState<Unit>(product.recent?.unit ?? (product.servingLabel === "ml" ? "ml" : "g"));
  // Per-piece history values can't be converted to grams, so they stay in pieces.
  const unitOptions: Unit[] = product.recent?.unit === "piece" ? ["piece"] : ["g", "ml", "piece"];
  // null = idle, "today" = log to today only, "library" = save to library only
  const [savingMode, setSavingMode] = useState<null | "today" | "library">(null);
  const [mealType, setMealType] = useState<MealType>(defaultMeal ?? defaultMealType());
  const saving = savingMode !== null;

  // Open Food Facts / USDA data is sometimes wrong, so the values can be corrected
  // here before logging. Strings while typing; negative or empty counts as 0.
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState({
    calories: String(product.per100.calories),
    protein: String(product.per100.protein),
    carbs: String(product.per100.carbs),
    fat: String(product.per100.fat),
  });
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
  const per100 = { calories: num(vals.calories), protein: num(vals.protein), carbs: num(vals.carbs), fat: num(vals.fat) };
  const edited =
    per100.calories !== product.per100.calories || per100.protein !== product.per100.protein ||
    per100.carbs !== product.per100.carbs || per100.fat !== product.per100.fat;
  const macroKcal = Math.round(per100.protein * 4 + per100.carbs * 4 + per100.fat * 9);
  const kcalMismatch = per100.calories > 0 && Math.abs(macroKcal - per100.calories) / per100.calories > 0.25;

  const numAmount = Math.max(1, Number(amount) || 1);
  // per100 is always per 100 g/ml. For pieces we treat 1 piece = 1 serving (100g worth).
  const mult = unit === "piece" ? numAmount : numAmount / 100;
  const preview = {
    calories: Math.round(per100.calories * mult),
    protein:  Math.round(per100.protein  * mult * 10) / 10,
    carbs:    Math.round(per100.carbs    * mult * 10) / 10,
    fat:      Math.round(per100.fat      * mult * 10) / 10,
  };

  const unitLabel = unit === "g" ? "g" : unit === "ml" ? "ml" : "adet";
  const servingLabelForApi = unit === "piece" ? "piece" : unit;
  const servingSizeForApi  = unit === "piece" ? 1 : 100;
  const fullName = product.name + (product.brand ? ` (${product.brand})` : "");

  async function handleSave(mode: "today" | "library") {
    if (saving) return;
    setSavingMode(mode);
    try {
      if (mode === "library") {
        // Save to meal library only (base serving) — never touches the daily log
        await fetch("/api/meals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            calories: per100.calories,
            protein:  per100.protein,
            carbs:    per100.carbs,
            fat:      per100.fat,
            servingSize: servingSizeForApi,
            servingLabel: servingLabelForApi,
            isFavorite: false,
          }),
        });
      } else {
        // Ad-hoc: log straight to the day, no permanent library entry
        await fetch("/api/log-meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            calories: per100.calories,
            protein:  per100.protein,
            carbs:    per100.carbs,
            fat:      per100.fat,
            servingSize: servingSizeForApi,
            servingLabel: servingLabelForApi,
            quantity: mult,
            mealType,
            date: dateParam,
          }),
        });
      }
      posthog.capture("food_db_used", { source: product.source });
      onDone();
    } catch {
      // Re-enable buttons so the user can retry
      setSavingMode(null);
    }
  }

  // Macro split by calories (4/4/9 kcal per g) for the stacked bar.
  const pCal = preview.protein * 4;
  const cCal = preview.carbs * 4;
  const fCal = preview.fat * 9;
  const macroCalTotal = pCal + cCal + fCal;
  const pct = (v: number) => (macroCalTotal > 0 ? Math.round((v / macroCalTotal) * 100) : 0);
  const quickAmounts = unit === "piece" ? [1, 2, 3, 4] : [50, 100, 150, 200, 250];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center sm:px-4" onClick={onCancel}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Product header */}
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-800">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl">🥫</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-lg font-bold leading-tight text-white">{product.name}</p>
            {product.brand && <p className="mt-0.5 text-sm text-zinc-500">{product.brand}</p>}
            <p className="mt-1.5 text-xs text-zinc-600">
              {per100.calories} kcal / {product.recent?.unit === "piece" ? "adet" : `100${product.servingLabel}`}
            </p>
          </div>
          <button onClick={onCancel} aria-label="Close" className="text-zinc-500 hover:text-white">✕</button>
        </div>

        {/* Serving size */}
        <div className="mb-4 rounded-2xl bg-zinc-800/60 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Serving size</p>
            <div className="flex gap-1">
              {unitOptions.map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    unit === u ? "bg-green-600 text-white" : "bg-zinc-700/60 text-zinc-400 hover:text-white"
                  }`}
                >
                  {u === "piece" ? "adet" : u}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-2xl font-bold text-white outline-none focus:border-green-600"
              autoFocus
            />
            <span className="w-10 text-sm text-zinc-500">{unitLabel}</span>
          </div>
          <div className="flex gap-1.5">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  numAmount === q ? "bg-zinc-600 text-white" : "bg-zinc-700/50 text-zinc-400 hover:text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Meal type (applies to "Add to today") */}
        <div className="mb-4 rounded-2xl bg-zinc-800/60 p-3.5">
          <p className="mb-2 text-sm font-semibold text-white">Meal</p>
          <MealTypePicker value={mealType} onChange={setMealType} />
        </div>

        {/* Nutrition facts */}
        <div className="mb-5 rounded-2xl bg-zinc-800/60 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              Nutrition facts{edited && <span className="ml-2 text-[11px] font-medium text-amber-400">edited</span>}
            </p>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-semibold text-green-400 hover:text-green-300"
            >
              {editing ? "Done" : "Edit nutrition"}
            </button>
          </div>
          {editing && (
            <div className="mb-3 rounded-xl bg-zinc-900/60 p-3">
              <p className="mb-2 text-[11px] text-zinc-500">
                Values per {unit === "piece" ? "piece" : `100 ${unit}`}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  ["calories", "kcal"],
                  ["protein", "Protein g"],
                  ["carbs", "Carbs g"],
                  ["fat", "Fat g"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-center text-[10px] text-zinc-500">{label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={vals[key]}
                      onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1 py-2 text-center text-sm font-bold text-white outline-none focus:border-green-600"
                    />
                  </label>
                ))}
              </div>
              {kcalMismatch && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Calories don&apos;t match the macros (they add up to about {macroKcal} kcal).
                </p>
              )}
              {edited && (
                <button
                  type="button"
                  onClick={() =>
                    setVals({
                      calories: String(product.per100.calories),
                      protein: String(product.per100.protein),
                      carbs: String(product.per100.carbs),
                      fat: String(product.per100.fat),
                    })
                  }
                  className="mt-2 text-[11px] text-zinc-500 underline hover:text-zinc-300"
                >
                  Reset to original
                </button>
              )}
            </div>
          )}
          <p className="mb-3 text-4xl font-black tabular-nums text-white">
            {preview.calories}
            <span className="ml-1 text-sm font-medium text-zinc-500">kcal</span>
          </p>
          <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-700">
            {macroCalTotal > 0 && (
              <>
                <div className="h-full bg-blue-400" style={{ width: `${(pCal / macroCalTotal) * 100}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${(cCal / macroCalTotal) * 100}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${(fCal / macroCalTotal) * 100}%` }} />
              </>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Protein", g: preview.protein, p: pct(pCal), dot: "bg-blue-400" },
              { label: "Carbs", g: preview.carbs, p: pct(cCal), dot: "bg-amber-400" },
              { label: "Fat", g: preview.fat, p: pct(fCal), dot: "bg-rose-400" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-zinc-900/60 py-2">
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                  {m.label} {m.p}%
                </p>
                <p className="text-base font-bold tabular-nums text-white">{m.g}g</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleSave("library")}
            disabled={saving}
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-green-600 hover:text-green-400 disabled:opacity-50"
          >
            {savingMode === "library" ? "Saving…" : "Save to library"}
          </button>
          <button
            onClick={() => handleSave("today")}
            disabled={saving}
            className="flex-[1.4] rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {savingMode === "today" ? "Adding…" : "Add to today"}
          </button>
        </div>
        <p className="mt-2 px-1 text-center text-[11px] leading-snug text-zinc-600">
          "Save to library" doesn&apos;t log it; "Add to today" doesn&apos;t save it to your library.
        </p>
      </div>
    </div>
  );
}

// ─── Label Scanner (photo of a Nutrition Facts panel → editable values) ──────

interface LabelForm {
  name: string;
  unit: "g" | "ml";
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

function LabelScanner({ onProduct }: { onProduct: (p: NormalizedProduct) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [form, setForm] = useState<LabelForm | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setWarnings([]);
    setForm(null);
    try {
      const image = await fileToResizedDataUrl(file, 1600, 0.85);
      const res = await fetch("/api/nutrition-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not read the label.");
        return;
      }
      const v = (n: number | null) => (n === null || n === undefined ? "" : String(n));
      setWarnings(data.warnings ?? []);
      setForm({
        name: data.name ?? "",
        unit: data.unit === "ml" ? "ml" : "g",
        calories: v(data.per100.calories),
        protein: v(data.per100.protein),
        carbs: v(data.per100.carbs),
        fat: v(data.per100.fat),
      });
      posthog.capture("label_scanned");
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!form || !form.name.trim()) return;
    const num = (x: string) => Math.max(0, Number(x) || 0);
    onProduct({
      code: `label-${Date.now()}`,
      name: form.name.trim(),
      brand: "",
      imageUrl: null,
      source: "LABEL",
      servingLabel: form.unit,
      per100: {
        calories: Math.round(num(form.calories)),
        protein: Math.round(num(form.protein) * 10) / 10,
        carbs: Math.round(num(form.carbs) * 10) / 10,
        fat: Math.round(num(form.fat) * 10) / 10,
      },
    });
  }

  const field = (key: "calories" | "protein" | "carbs" | "fat", label: string, suffix: string) =>
    form && (
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-zinc-400">{label}</span>
        <div className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 focus-within:border-green-600">
          <input
            type="number"
            inputMode="decimal"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder="—"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
          />
          <span className="text-[11px] text-zinc-500">{suffix}</span>
        </div>
      </label>
    );

  const pickerBtn =
    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-colors";

  return (
    <div className="space-y-3">
      <p className="text-xs leading-snug text-zinc-500">
        Take a clear, well-lit photo of the Nutrition Facts panel. Only printed values are read — nothing is estimated.
      </p>

      <div className="flex gap-2">
        <label className={`${pickerBtn} bg-green-600 text-white hover:bg-green-500`}>
          📷 Take photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
        <label className={`${pickerBtn} border border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500`}>
          🖼️ Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
      </div>

      {busy && (
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-zinc-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-green-500" />
          Reading label…
        </div>
      )}

      {error && <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      {form && !busy && (
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          {warnings.map((w) => (
            <p key={w} className="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-300">{w}</p>
          ))}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-400">Product name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Peanut butter"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-green-600"
            />
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-300">Per 100 {form.unit}</p>
            <div className="flex gap-1">
              {(["g", "ml"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setForm({ ...form, unit: u })}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                    form.unit === u ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("calories", "Calories", "kcal")}
            {field("protein", "Protein", "g")}
            {field("carbs", "Carbs", "g")}
            {field("fat", "Fat", "g")}
          </div>
          <button
            onClick={submit}
            disabled={!form.name.trim() || form.calories === ""}
            className="w-full rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-green-500 disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function FoodDatabaseModal({ onClose, dateParam, onAdded, initialTab = "search", initialMealType }: Props) {
  const [tab, setTab] = useState<"search" | "barcode" | "label">(initialTab);

  // Search state
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<NormalizedProduct[]>([]);
  const [searching, setSearching]   = useState(false);
  const [noResults, setNoResults]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Barcode state
  const [barcodeInput, setBarcodeInput]     = useState("");
  const [barcodeProduct, setBarcodeProduct] = useState<NormalizedProduct | null>(null);
  const [barcodeError, setBarcodeError]     = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [isScanning, setIsScanning]         = useState(false); // decode loop actively running
  const [torchOn, setTorchOn]               = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Recently logged foods, shown while the search box is empty
  const [history, setHistory] = useState<NormalizedProduct[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/food-history")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (!cancelled) setHistory((d.items ?? []).map(fromHistory)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Add quantity
  const [addingProduct, setAddingProduct] = useState<NormalizedProduct | null>(null);

  // Batch list: "+" on a result queues it at 100 g/ml; the whole list is
  // logged to the day in one go from the footer.
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [savingQueue, setSavingQueue] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [queueMealType, setQueueMealType] = useState<MealType>(initialMealType ?? defaultMealType());
  const queuedCodes = new Set(queue.map((q) => q.product.code));
  const queueKcal = Math.round(queue.reduce((s, q) => s + q.product.per100.calories * unitMult(q.unit, q.amount), 0));

  function toggleQueue(p: NormalizedProduct) {
    setQueueError("");
    setQueue((prev) =>
      prev.some((q) => q.product.code === p.code)
        ? prev.filter((q) => q.product.code !== p.code)
        : [...prev, { product: p, amount: p.recent?.amount ?? 100, unit: p.recent?.unit ?? p.servingLabel }]
    );
  }

  function setQueueAmount(code: string, amount: number) {
    setQueue((prev) => prev.map((q) => (q.product.code === code ? { ...q, amount } : q)));
  }

  async function saveQueue() {
    if (savingQueue || queue.length === 0) return;
    setSavingQueue(true);
    setQueueError("");
    const settled = await Promise.allSettled(
      queue.map(({ product, amount, unit }) =>
        fetch("/api/log-meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: foodLabel(product),
            calories: product.per100.calories,
            protein:  product.per100.protein,
            carbs:    product.per100.carbs,
            fat:      product.per100.fat,
            servingSize: unit === "piece" ? 1 : 100,
            servingLabel: unit,
            quantity: unitMult(unit, Math.max(unit === "piece" ? 0.5 : 1, amount)),
            mealType: queueMealType,
            date: dateParam,
          }),
        }).then((r) => { if (!r.ok) throw new Error("save failed"); })
      )
    );
    const failed = queue.filter((_, i) => settled[i].status === "rejected");
    if (failed.length === 0) {
      posthog.capture("food_db_batch_used", { count: queue.length });
      onAdded();
      onClose();
      return;
    }
    // Keep only what didn't save so a retry can't double-log the rest.
    if (failed.length < queue.length) onAdded();
    setQueue(failed);
    setQueueError(`${failed.length} item${failed.length > 1 ? "s" : ""} failed to save — try again.`);
    setSavingQueue(false);
  }

  // ── Search ──────────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setNoResults(false); return; }
    setSearching(true);
    setNoResults(false);
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const products: NormalizedProduct[] = (data.products ?? [])
        .map((p: OFFProduct) => normalize(p))
        .filter(Boolean) as NormalizedProduct[];
      setResults(products);
      setNoResults(products.length === 0);
    } catch {
      setNoResults(true);
    } finally {
      setSearching(false);
    }
  // doSearch never changes — no external deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce: only re-run when query text changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // doSearch is stable (empty deps), safe to omit from array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── Barcode lookup (manual entry or a scanned code) ───────────────────

  async function fetchBarcode(code: string, method: "camera" | "manual" = "manual") {
    const trimmed = code.trim();
    if (!trimmed) return;
    posthog.capture("barcode_scanned", { method });
    setBarcodeError("");
    setBarcodeProduct(null);
    setBarcodeLoading(true);
    try {
      const res  = await fetch(`/api/food-barcode?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        setBarcodeError("Product not found.");
        return;
      }
      const p = normalize({ code: trimmed, ...data.product });
      if (!p) { setBarcodeError("Product information is incomplete."); return; }
      setBarcodeProduct(p);
    } catch {
      setBarcodeError("Connection error.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  // ── Camera scanning ───────────────────────────────────────────────────
  // The stream is opened ONCE while the barcode tab is active and stays open
  // until the tab changes / the modal closes. To rescan we only restart ZXing's
  // one-shot decode (decodeOnceFromStream) — the stream is never torn down and
  // rebuilt, which is what used to cause the open/close race.

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    readerRef.current = null;
    // Detaching the source makes any in-flight decode loop bail out on its own.
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
  }

  /** One-shot decode against the already-open stream. */
  async function scan() {
    const reader = readerRef.current;
    const stream = streamRef.current;
    const video  = videoRef.current;
    if (!reader || !stream || !video) return;

    setBarcodeProduct(null);
    setBarcodeError("");
    setIsScanning(true);
    try {
      // Resolves on the first barcode read; stops only the decode loop, NOT the
      // stream, so the live preview keeps running afterwards.
      const result = await reader.decodeOnceFromStream(stream, video);
      if (streamRef.current !== stream) return; // camera was torn down meanwhile
      setIsScanning(false);
      const code = result.getText();
      setBarcodeInput(code);
      fetchBarcode(code, "camera");
    } catch {
      // No barcode / stream ended — drop back to idle if still the same stream.
      if (streamRef.current === stream) setIsScanning(false);
    }
  }

  /** Open the stream once (lazy-loading ZXing) and kick off the first scan.
   *  `isActive` lets the lifecycle effect abort if the tab changed mid-await.
   *  The dynamic import runs first so nothing is set synchronously from the effect;
   *  scan() (called after the awaits) owns the product/error/isScanning reset. */
  async function openCamera(isActive: () => boolean = () => true) {
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!isActive()) return;
      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();

      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!isActive()) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchSupported(Boolean(caps?.torch));
      }
      if (isActive()) scan();
    } catch {
      if (isActive()) { setBarcodeError("Camera access denied."); setIsScanning(false); }
    }
  }

  /** "Tekrar Tara": clear results, create a fresh reader, restart decode on
   *  the already-open stream (or reopen if it was lost). */
  async function rescan() {
    setBarcodeProduct(null);
    setBarcodeError("");
    setBarcodeInput("");
    // Fresh reader instance discards any lingering decode state.
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    readerRef.current = new BrowserMultiFormatReader();
    if (streamRef.current) scan();
    else openCamera();
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch { /* device doesn't support applyConstraints for torch */ }
  }

  // Camera lifecycle is driven solely by the barcode tab being active.
  useEffect(() => {
    if (tab !== "barcode") return;
    let active = true;
    // openCamera only updates state asynchronously (after its awaits), so the
    // "synchronous setState in effect" concern does not apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCamera(() => active);
    return () => { active = false; stopCamera(); };
  // openCamera/stopCamera are stable for this lifecycle effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Render ────────────────────────────────────────────────────────────

  function ProductCard({ product }: { product: NormalizedProduct }) {
    const queued = queuedCodes.has(product.code);
    const r = product.recent;
    const shown = r ? unitMult(r.unit, r.amount) : 1;
    const show = (n: number) => Math.round(n * shown * 10) / 10;
    return (
      <div
        onClick={() => setAddingProduct(product)}
        className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-zinc-900 p-3 transition-colors hover:border-zinc-600 ${
          queued ? "border-green-700" : "border-zinc-800"
        }`}
      >
        {/* Image */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">🥫</span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5 min-w-0">
            <p className="line-clamp-2 text-sm font-bold text-white leading-tight">{product.name}</p>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              product.source === "USDA" ? "bg-blue-950 text-blue-400" : "bg-zinc-800 text-zinc-500"
            }`}>
              {product.source === "USDA" ? "USDA" : product.source === "HISTORY" ? "🕘" : "OFF"}
            </span>
          </div>
          {product.brand && <p className="mb-1.5 text-[11px] text-zinc-500">{product.brand}</p>}
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-white">{Math.round(product.per100.calories * shown)} kcal</span>
            <MacroBadge label="P" value={show(product.per100.protein)} unit="g" color="bg-blue-950 text-blue-300" />
            <MacroBadge label="C" value={show(product.per100.carbs)}   unit="g" color="bg-amber-950 text-amber-300" />
            <MacroBadge label="F" value={show(product.per100.fat)}     unit="g" color="bg-rose-950 text-rose-300" />
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">{r ? `${r.amount}${r.unit === "piece" ? " adet" : r.unit} · last time` : "/ 100g"}</p>
        </div>

        {/* Quick add to list (100 g/ml) — tap the card itself to pick an amount */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleQueue(product); }}
          aria-label={queued ? "Remove from list" : "Add to list"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold transition-colors ${
            queued ? "bg-green-600 text-white" : "bg-zinc-800 text-green-400 hover:bg-zinc-700"
          }`}
        >
          {queued ? "✓" : "+"}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — full-screen on mobile, centred sheet on sm+ */}
      <div
        className="fixed inset-0 z-50 flex flex-col bg-zinc-950 sm:items-center sm:justify-center sm:bg-black/70 sm:backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="
            flex flex-col
            w-full h-full
            sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl sm:border sm:border-zinc-700 sm:shadow-2xl
            bg-zinc-950
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="text-base font-black text-white leading-tight">🔍 Food Database</h2>
              <p className="text-[11px] text-zinc-500">Open Food Facts</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-zinc-800 px-4">
            {((AI_ENABLED ? ["search", "barcode", "label"] : ["search", "barcode"]) as ("search" | "barcode" | "label")[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "border-b-2 border-green-500 text-green-400"
                    : "text-zinc-500"
                }`}
              >
                {t === "search" ? "🔎 Ara" : t === "barcode" ? "📷 Barkod" : "🏷️ Etiket"}
              </button>
            ))}
          </div>

          {/* Scrollable body — min-h-0 is critical for flex overflow */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-safe">

            {/* ── Search Tab ── */}
            {tab === "search" && (
              <>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Type a product name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-green-600 placeholder:text-zinc-600"
                  />
                </div>

                {searching && (
                  <div className="flex justify-center py-8">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-green-500" />
                  </div>
                )}
                {!searching && noResults && query.trim() && (
                  <p className="py-6 text-center text-sm text-zinc-500">No results found for "{query}".</p>
                )}
                {!searching && results.length === 0 && !noResults && history.length === 0 && (
                  <p className="py-10 text-center text-sm text-zinc-600">Type a product to search…</p>
                )}
                {!query.trim() && !searching && history.length > 0 && (
                  <div className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Recent</p>
                    {history.map((p) => <ProductCard key={p.code} product={p} />)}
                  </div>
                )}
                <div className="space-y-2">
                  {results.map((p) => <ProductCard key={p.code} product={p} />)}
                </div>
              </>
            )}

            {/* ── Barcode Tab ── */}
            {/* ── Label Tab ── */}
            {tab === "label" && <LabelScanner onProduct={(p) => setAddingProduct(p)} />}

            {tab === "barcode" && (
              <>
                {/* Manual input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Barcode number…"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchBarcode(barcodeInput)}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-green-600 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => fetchBarcode(barcodeInput)}
                    className="rounded-xl bg-green-600 px-5 text-sm font-bold text-white hover:bg-green-500 transition-colors"
                  >
                    Ara
                  </button>
                </div>

                {/* Live camera — hidden when a result or error fills the screen so
                    Tekrar Tara is always visible without scrolling.
                    The <video> stays in the DOM so the stream keeps running. */}
                <div className={`relative overflow-hidden rounded-2xl border border-zinc-700 bg-black${(barcodeProduct || barcodeError) ? " hidden" : ""}`}>
                  <video ref={videoRef} className="w-full" muted playsInline />

                  {/* targeting frame — only while actively scanning */}
                  {isScanning && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-64 rounded-2xl border-2 border-green-400 opacity-80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                    </div>
                  )}

                  {/* Torch toggle — only when the device supports it */}
                  {torchSupported && (
                    <button
                      onClick={toggleTorch}
                      className={`absolute right-2 top-2 rounded-full p-2.5 text-xl backdrop-blur transition-colors ${
                        torchOn ? "bg-yellow-400/90 text-black" : "bg-black/60 text-white hover:bg-black/80"
                      }`}
                      title={torchOn ? "Turn Off Flash" : "Turn On Flash"}
                    >
                      🔦
                    </button>
                  )}

                  {/* status hint while scanning */}
                  {isScanning && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
                      Line the barcode up in the frame…
                    </div>
                  )}
                </div>

                {barcodeLoading && (
                  <div className="flex justify-center py-6">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-green-500" />
                  </div>
                )}

                {/* Error — camera stays open, offer a rescan */}
                {barcodeError && !barcodeLoading && (
                  <div className="space-y-2">
                    <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400">{barcodeError}</p>
                    <button
                      onClick={rescan}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-semibold text-zinc-300 hover:border-green-600 hover:text-green-400 transition-colors"
                    >
                      Tekrar Tara
                    </button>
                  </div>
                )}

                {/* Result — camera is NOT closed; just show it and offer a rescan */}
                {barcodeProduct && !barcodeLoading && (
                  <div className="space-y-2">
                    <ProductCard product={barcodeProduct} />
                    <button
                      onClick={rescan}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-semibold text-zinc-300 hover:border-green-600 hover:text-green-400 transition-colors"
                    >
                      Tekrar Tara
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Batch list footer */}
          {queue.length > 0 && (
            <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 pt-3 pb-4">
              {showQueue && (
                <div className="mb-3 max-h-48 space-y-1.5 overflow-y-auto">
                  {queue.map((q) => (
                    <div key={q.product.code} className="flex items-center gap-2 rounded-xl bg-zinc-800/60 px-3 py-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{q.product.name}</p>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={q.amount}
                        onChange={(e) => setQueueAmount(q.product.code, Number(e.target.value) || 0)}
                        className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-xs font-bold text-white outline-none focus:border-green-600"
                      />
                      <span className="w-8 text-[11px] text-zinc-500">{unitText(q.unit)}</span>
                      <button
                        onClick={() => toggleQueue(q.product)}
                        aria-label="Remove"
                        className="text-xs text-zinc-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {queueError && <p className="mb-2 text-xs text-red-400">{queueError}</p>}
              <div className="mb-3">
                <MealTypePicker value={queueMealType} onChange={setQueueMealType} compact />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQueue((v) => !v)}
                  className="flex items-center gap-2 text-left"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                    {queue.length}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-white">
                      {queue.length === 1 ? "1 item" : `${queue.length} items`} in list {showQueue ? "▾" : "▴"}
                    </span>
                    <span className="block text-[11px] text-zinc-500">{queueKcal} kcal · tap to edit amounts</span>
                  </span>
                </button>
                <button
                  onClick={saveQueue}
                  disabled={savingQueue}
                  className="ml-auto rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-50"
                >
                  {savingQueue ? "Adding…" : "Add to today"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quantity sub-modal */}
      {addingProduct && (
        <AddQuantityModal
          product={addingProduct}
          dateParam={dateParam}
          defaultMeal={queueMealType}
          onCancel={() => setAddingProduct(null)}
          onDone={() => {
            setAddingProduct(null);
            onAdded();
            // Keep the modal open if there's a pending list so it isn't lost.
            if (queue.length === 0) onClose();
          }}
        />
      )}
    </>
  );
}
