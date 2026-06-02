"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OFFProduct {
  code: string;
  product_name: string;
  brands?: string;
  image_thumb_url?: string;
  nutriments: {
    "energy-kcal_100g"?: number;
    "proteins_100g"?: number;
    "carbohydrates_100g"?: number;
    "fat_100g"?: number;
  };
}

interface NormalizedProduct {
  code: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  per100: { calories: number; protein: number; carbs: number; fat: number };
}

interface Props {
  onClose: () => void;
  dateParam: string | null;
  onAdded: () => void; // refresh parent meal list
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(p: OFFProduct): NormalizedProduct | null {
  const name = p.product_name?.trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  return {
    code: p.code,
    name,
    brand: p.brands?.split(",")[0]?.trim() ?? "",
    imageUrl: p.image_thumb_url ?? null,
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
}: {
  product: NormalizedProduct;
  dateParam: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [grams, setGrams] = useState("100");
  const [saving, setSaving] = useState(false);

  const g = Math.max(1, Number(grams) || 100);
  const mult = g / 100;
  const preview = {
    calories: Math.round(product.per100.calories * mult),
    protein:  Math.round(product.per100.protein  * mult * 10) / 10,
    carbs:    Math.round(product.per100.carbs    * mult * 10) / 10,
    fat:      Math.round(product.per100.fat      * mult * 10) / 10,
  };

  async function handleSave() {
    setSaving(true);
    // 1. Save to meal library (base: per 100g)
    const mealRes = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: product.name + (product.brand ? ` (${product.brand})` : ""),
        calories: product.per100.calories,
        protein:  product.per100.protein,
        carbs:    product.per100.carbs,
        fat:      product.per100.fat,
        servingSize: 100,
        servingLabel: "g",
        isFavorite: false,
      }),
    });
    const mealData = await mealRes.json();
    const mealId = mealData.id ?? mealData.meal?.id;

    // 2. Log to today / dateParam
    if (mealId) {
      await fetch("/api/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, quantity: mult, date: dateParam }),
      });
    }
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-bold text-white leading-tight">{product.name}</p>
            {product.brand && <p className="text-xs text-zinc-500">{product.brand}</p>}
          </div>
          <button onClick={onCancel} className="ml-3 text-zinc-500 hover:text-white">✕</button>
        </div>

        <label className="mb-1 block text-xs font-semibold text-zinc-400">Miktar (gram)</label>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="number"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-center text-lg font-bold text-white outline-none focus:border-green-600"
            autoFocus
          />
          <span className="text-sm text-zinc-500">g</span>
        </div>

        <div className="mb-4 rounded-xl bg-zinc-800 p-3">
          <p className="mb-1 text-[11px] text-zinc-500">Önizleme ({g}g)</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-bold text-white">{preview.calories} kcal</span>
            <span className="rounded-full bg-blue-950 px-2.5 py-0.5 text-xs font-semibold text-blue-300">P {preview.protein}g</span>
            <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-semibold text-amber-300">K {preview.carbs}g</span>
            <span className="rounded-full bg-rose-950 px-2.5 py-0.5 text-xs font-semibold text-rose-300">Y {preview.fat}g</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/30 hover:bg-green-500 transition-colors disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "✓ Ekle ve Logla"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function FoodDatabaseModal({ onClose, dateParam, onAdded }: Props) {
  const [tab, setTab] = useState<"search" | "barcode">("search");

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
  const [scanningCam, setScanningCam]       = useState(false);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const readerRef       = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  // Guards against duplicate in-flight barcode fetches and camera multi-fire
  const fetchingRef     = useRef(false);
  const scannedRef      = useRef(false);

  // Add quantity
  const [addingProduct, setAddingProduct] = useState<NormalizedProduct | null>(null);

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

  // ── Barcode fetch — stable ref, guarded against duplicate calls ──────

  const fetchBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Prevent concurrent fetches for the same or different code
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setBarcodeError("");
    setBarcodeProduct(null);   // clear previous result only once, here
    setBarcodeLoading(true);
    try {
      const res  = await fetch(`/api/food-barcode?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        setBarcodeError("Ürün bulunamadı.");
        return;
      }
      const p = normalize({ code: trimmed, ...data.product });
      if (!p) { setBarcodeError("Ürün bilgileri eksik."); return; }
      setBarcodeProduct(p);      // set once, never cleared again until next manual search
    } catch {
      setBarcodeError("Bağlantı hatası.");
    } finally {
      setBarcodeLoading(false);
      fetchingRef.current = false;
    }
  }, []);  // stable — no captured state, only refs + setters

  // ── Camera scanning ───────────────────────────────────────────────────

  async function startCamera() {
    scannedRef.current = false;   // reset for new scan session
    setScanningCam(true);
    setBarcodeError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        reader.decodeFromStream(stream, videoRef.current, (result) => {
          // decodeFromStream fires on every frame — only process the FIRST hit
          if (result && !scannedRef.current) {
            scannedRef.current = true;
            const code = result.getText();
            stopCamera();
            setBarcodeInput(code);
            fetchBarcode(code);
          }
        });
      }
    } catch {
      setBarcodeError("Kamera erişimi reddedildi.");
      setScanningCam(false);
    }
  }

  function stopCamera() {
    setScanningCam(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    readerRef.current = null;
  }

  // Stop camera on unmount
  useEffect(() => () => stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────

  function ProductCard({ product }: { product: NormalizedProduct }) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors">
        {/* Image */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🥫</span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white leading-tight">{product.name}</p>
          {product.brand && <p className="mb-1.5 text-[11px] text-zinc-500">{product.brand}</p>}
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-white">{product.per100.calories} kcal</span>
            <MacroBadge label="P" value={product.per100.protein} unit="g" color="bg-blue-950 text-blue-300" />
            <MacroBadge label="K" value={product.per100.carbs}   unit="g" color="bg-amber-950 text-amber-300" />
            <MacroBadge label="Y" value={product.per100.fat}     unit="g" color="bg-rose-950 text-rose-300" />
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">/ 100g</p>
        </div>

        {/* Add button */}
        <button
          onClick={() => setAddingProduct(product)}
          className="shrink-0 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-green-900/30 hover:bg-green-500 transition-colors"
        >
          + Ekle
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
            {(["search", "barcode"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "border-b-2 border-green-500 text-green-400"
                    : "text-zinc-500"
                }`}
              >
                {t === "search" ? "🔎 Ara" : "📷 Barkod"}
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
                    placeholder="Ürün adı yaz…"
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
                  <p className="py-6 text-center text-sm text-zinc-500">"{query}" için sonuç bulunamadı.</p>
                )}
                {!searching && results.length === 0 && !noResults && (
                  <p className="py-10 text-center text-sm text-zinc-600">Aramak istediğin ürünü yaz…</p>
                )}
                <div className="space-y-2">
                  {results.map((p) => <ProductCard key={p.code} product={p} />)}
                </div>
              </>
            )}

            {/* ── Barcode Tab ── */}
            {tab === "barcode" && (
              <>
                {/* Manual input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Barkod numarası…"
                    value={barcodeInput}
                    onChange={(e) => {
                      setBarcodeInput(e.target.value);
                      // reset guard so a new manual entry can trigger a fresh fetch
                      fetchingRef.current = false;
                    }}
                    onKeyDown={(e) => e.key === "Enter" && fetchBarcode(barcodeInput)}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-green-600 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => { fetchingRef.current = false; fetchBarcode(barcodeInput); }}
                    className="rounded-xl bg-green-600 px-5 text-sm font-bold text-white hover:bg-green-500 transition-colors"
                  >
                    Ara
                  </button>
                </div>

                {/* Camera button — big and easy to tap */}
                {!scanningCam ? (
                  <button
                    onClick={startCamera}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900 py-8 text-zinc-300 hover:border-green-600 hover:text-green-400 transition-colors active:scale-95"
                  >
                    <span className="text-5xl">📷</span>
                    <span className="text-base font-bold">Kamerayla Tara</span>
                    <span className="text-xs text-zinc-500">Barkodu kameraya göster</span>
                  </button>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-black">
                    <video ref={videoRef} className="w-full" muted playsInline />
                    {/* targeting overlay */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-64 rounded-2xl border-2 border-green-400 opacity-80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                    </div>
                    <button
                      onClick={stopCamera}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/90"
                    >
                      ✕ Durdur
                    </button>
                  </div>
                )}

                {barcodeLoading && (
                  <div className="flex justify-center py-6">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-green-500" />
                  </div>
                )}
                {barcodeError && (
                  <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400">{barcodeError}</p>
                )}
                {barcodeProduct && !barcodeLoading && (
                  <ProductCard product={barcodeProduct} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quantity sub-modal */}
      {addingProduct && (
        <AddQuantityModal
          product={addingProduct}
          dateParam={dateParam}
          onCancel={() => setAddingProduct(null)}
          onDone={() => {
            setAddingProduct(null);
            onAdded();
            onClose();
          }}
        />
      )}
    </>
  );
}
