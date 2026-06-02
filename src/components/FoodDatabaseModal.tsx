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

const FIELDS = "product_name,brands,nutriments,image_thumb_url,code";

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
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeProduct, setBarcodeProduct] = useState<NormalizedProduct | null>(null);
  const [barcodeError, setBarcodeError]     = useState("");
  const [scanningCam, setScanningCam]       = useState(false);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const readerRef   = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  // Add quantity
  const [addingProduct, setAddingProduct] = useState<NormalizedProduct | null>(null);

  // ── Search ──────────────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setNoResults(false); return; }
    setSearching(true);
    setNoResults(false);
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=12&fields=${FIELDS}`;
      const res = await fetch(url);
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
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // ── Barcode text search ───────────────────────────────────────────────

  async function fetchBarcode(code: string) {
    setBarcodeError("");
    setBarcodeProduct(null);
    if (!code.trim()) return;
    setSearching(true);
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code.trim()}.json`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        setBarcodeError("Ürün bulunamadı.");
        return;
      }
      const p = normalize({ code, ...data.product });
      if (!p) { setBarcodeError("Ürün bilgileri eksik."); return; }
      setBarcodeProduct(p);
    } catch {
      setBarcodeError("Bağlantı hatası.");
    } finally {
      setSearching(false);
    }
  }

  // ── Camera scanning ───────────────────────────────────────────────────

  async function startCamera() {
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
          if (result) {
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
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
        <div
          className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="font-black text-white">🔍 Food Database</h2>
              <p className="text-xs text-zinc-500">Powered by Open Food Facts</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
              Kapat
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-800 px-5 pt-3 pb-0">
            {(["search", "barcode"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t ? "border-b-2 border-green-500 text-green-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "search" ? "🔎 Ara" : "📷 Barkod"}
              </button>
            ))}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

            {/* ── Search Tab ── */}
            {tab === "search" && (
              <>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ürün adı yaz (örn. yoğurt, tavuk göğsü)…"
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Barkod numarası (örn. 8690526040818)"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchBarcode(barcodeInput)}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-green-600 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => fetchBarcode(barcodeInput)}
                    className="rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-500 transition-colors"
                  >
                    Ara
                  </button>
                </div>

                {/* Camera scan button */}
                {!scanningCam ? (
                  <button
                    onClick={startCamera}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                  >
                    📷 Kamerayla Tara
                  </button>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
                    <video ref={videoRef} className="w-full rounded-2xl" muted playsInline />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-36 w-36 rounded-xl border-2 border-green-400 opacity-70" />
                    </div>
                    <button
                      onClick={stopCamera}
                      className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/80"
                    >
                      Durdur
                    </button>
                  </div>
                )}

                {searching && (
                  <div className="flex justify-center py-6">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-green-500" />
                  </div>
                )}

                {barcodeError && (
                  <p className="rounded-xl bg-red-950/40 px-4 py-3 text-sm text-red-400">{barcodeError}</p>
                )}

                {barcodeProduct && !searching && (
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
