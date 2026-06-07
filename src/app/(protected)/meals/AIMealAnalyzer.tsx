"use client";

import { useEffect, useRef, useState } from "react";
import { posthog } from "@/lib/posthog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIItem {
  id: string;
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

type RawItem = Omit<AIItem, "id">;
interface RawResult {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: RawItem[];
}

type NumericField = "amount" | "calories" | "protein" | "carbs" | "fat";

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `ai-${Date.now().toString(36)}-${idCounter}`;
}

interface Props {
  dateParam: string | null;
  onClose: () => void;
  onAdded: () => void;
}

// ─── Image helper ─────────────────────────────────────────────────────────────

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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const resized = await fileToResizedDataUrl(file);
      setImage(resized);
    } catch {
      setError("Fotograf yuklenemedi, baska bir gorsel deneyin.");
    }
  }

  async function analyze() {
    setError("");
    if (!image && !message.trim()) {
      setError("Lutfen bir aciklama yazin veya fotograf ekleyin.");
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
        setError(data?.error ?? "Analiz basarisiz oldu, tekrar deneyin.");
        return;
      }
      const raw = data as RawResult;
      const items: AIItem[] = (raw.items ?? []).map((it) => ({ ...it, id: newId() }));
      setResult({
        totalCalories: raw.totalCalories,
        totalProtein: raw.totalProtein,
        totalCarbs: raw.totalCarbs,
        totalFat: raw.totalFat,
        items,
      });
      posthog.capture("ai_meal_analyzed", { hasImage: !!image, itemCount: items.length });
    } catch {
      setError("Baglanti hatasi. Internet baglantinizi kontrol edin.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateText(id: string, field: "name" | "unit", value: string) {
    setResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it) => (it.id === id ? { ...it, [field]: value } : it));
      return { ...prev, items, ...sumTotals(items) };
    });
  }

  function updateNumber(id: string, field: NumericField, value: string) {
    const n = value === "" ? 0 : Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    setResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it) => (it.id === id ? { ...it, [field]: safe } : it));
      return { ...prev, items, ...sumTotals(items) };
    });
  }

  function removeItem(id: string) {
    setResult((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((it) => it.id !== id);
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
      setError("Loglama basarisiz oldu, tekrar deneyin.");
      setLogging(null);
    }
  }

  return (
    // Tam ekran overlay
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.8)",
      }}
      onClick={onClose}
    >
      {/* Alt panel — sabit yukseklik yok, icerik uzadikca yukari uzar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: "16px 16px 0 0",
          background: "#18181b",
          padding: "16px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        {/* 1 — Baslik + X */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>AI ile Analiz</div>
            <div style={{ color: "#71717a", fontSize: 11, marginTop: 2 }}>GPT-4o · fotograf + aciklama</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid #3f3f46",
              background: "#27272a",
              color: "#a1a1aa",
              cursor: "pointer",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            X
          </button>
        </div>

        {/* 2 — Fotograf onizleme veya kamera/galeri butonlari */}
        {image ? (
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #3f3f46", marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Yemek" style={{ width: "100%", maxHeight: 220, objectFit: "contain", background: "#000", display: "block" }} />
            <button
              onClick={() => setImage(null)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Sil
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => cameraRef.current?.click()}
              style={{
                padding: "20px 8px",
                borderRadius: 12,
                border: "1px solid #3f3f46",
                background: "#27272a",
                color: "#d4d4d8",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Kameradan Cek
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              style={{
                padding: "20px 8px",
                borderRadius: 12,
                border: "1px solid #3f3f46",
                background: "#27272a",
                color: "#d4d4d8",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Galeriden Sec
            </button>
          </div>
        )}

        {/* 3 — Textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Ornek: 100gr pilav, 120gr tavuk gogusu"
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 12,
            border: "1px solid #3f3f46",
            background: "#27272a",
            color: "#fff",
            padding: 12,
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 12,
            fontFamily: "inherit",
          }}
        />

        {/* 4 — Analiz Et butonu */}
        <button
          onClick={analyze}
          disabled={analyzing}
          style={{
            width: "100%",
            borderRadius: 10,
            background: analyzing ? "#166534" : "#16a34a",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            padding: "14px 0",
            border: "none",
            cursor: analyzing ? "not-allowed" : "pointer",
            opacity: analyzing ? 0.7 : 1,
            marginBottom: 12,
          }}
        >
          {analyzing ? "GPT-4o analiz ediyor..." : "Analiz Et"}
        </button>

        {/* Hata mesaji */}
        {error && (
          <div style={{ borderRadius: 10, background: "rgba(127,29,29,0.3)", color: "#f87171", fontSize: 13, padding: "12px 14px", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* 5 — Sonuclar */}
        {result && (
          <div style={{ borderTop: "1px solid #27272a", paddingTop: 16 }}>
            {/* Toplam */}
            <div style={{ borderRadius: 12, border: "1px solid rgba(20,83,45,0.4)", background: "rgba(5,46,22,0.2)", padding: 16, marginBottom: 12 }}>
              <div style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Toplam</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
                <span style={{ color: "#4ade80", fontSize: 36, fontWeight: 900, lineHeight: 1 }}>{result.totalCalories}</span>
                <span style={{ color: "#71717a", fontSize: 13, marginBottom: 4 }}>kcal</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#172554", color: "#93c5fd" }}>P {result.totalProtein}g</span>
                <span style={{ borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#451a03", color: "#fcd34d" }}>K {result.totalCarbs}g</span>
                <span style={{ borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, background: "#4c0519", color: "#fda4af" }}>Y {result.totalFat}g</span>
              </div>
            </div>

            {/* Items baslik + duzenle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 600 }}>{result.items.length} yemek</span>
              <button
                onClick={() => setEditing((v) => !v)}
                style={{ borderRadius: 8, background: "#27272a", color: "#d4d4d8", fontSize: 12, fontWeight: 500, padding: "4px 12px", border: "none", cursor: "pointer" }}
              >
                {editing ? "Bitti" : "Duzenle"}
              </button>
            </div>

            {/* Item listesi */}
            <div style={{ marginBottom: 12 }}>
              {result.items.map((it) =>
                editing ? (
                  <div key={it.id} style={{ borderRadius: 10, border: "1px solid #3f3f46", background: "#27272a", padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        value={it.name}
                        onChange={(e) => updateText(it.id, "name", e.target.value)}
                        style={{ flex: 1, borderRadius: 8, background: "#3f3f46", border: "none", color: "#fff", padding: "6px 8px", fontSize: 13, outline: "none" }}
                      />
                      <button
                        onClick={() => removeItem(it.id)}
                        style={{ borderRadius: 8, background: "#3f3f46", border: "none", color: "#a1a1aa", padding: "0 10px", cursor: "pointer", fontSize: 13 }}
                      >
                        X
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 8, background: "#3f3f46", padding: "4px 8px" }}>
                        <span style={{ color: "#71717a", fontSize: 10 }}>Miktar</span>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={it.amount}
                          onChange={(e) => updateNumber(it.id, "amount", e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 13, textAlign: "right", outline: "none" }}
                        />
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 8, background: "#3f3f46", padding: "4px 8px" }}>
                        <span style={{ color: "#71717a", fontSize: 10 }}>Birim</span>
                        <input
                          value={it.unit}
                          onChange={(e) => updateText(it.id, "unit", e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 13, textAlign: "right", outline: "none" }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                      {(["calories", "protein", "carbs", "fat"] as const).map((f) => (
                        <label key={f} style={{ borderRadius: 8, background: "#3f3f46", padding: "4px 6px", textAlign: "center" }}>
                          <span style={{ display: "block", color: "#71717a", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>
                            {f === "calories" ? "kcal" : f === "protein" ? "P" : f === "carbs" ? "K" : "Y"}
                          </span>
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            value={it[f]}
                            onChange={(e) => updateNumber(it.id, f, e.target.value)}
                            style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 13, textAlign: "center", outline: "none" }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    key={it.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 10, border: "1px solid #3f3f46", background: "#27272a", padding: "10px 12px", marginBottom: 8 }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.name}
                        {it.amount ? <span style={{ color: "#71717a", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>{it.amount}{it.unit}</span> : null}
                      </div>
                      <div style={{ color: "#71717a", fontSize: 11, marginTop: 2 }}>P:{it.protein}g · K:{it.carbs}g · Y:{it.fat}g</div>
                    </div>
                    <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>{it.calories} kcal</span>
                  </div>
                )
              )}
            </div>

            {/* Log butonlari */}
            <button
              onClick={() => logMeal("single")}
              disabled={logging !== null || result.items.length === 0}
              style={{
                width: "100%",
                borderRadius: 10,
                background: "#16a34a",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                padding: "13px 0",
                border: "none",
                cursor: logging !== null ? "not-allowed" : "pointer",
                opacity: logging !== null || result.items.length === 0 ? 0.5 : 1,
                marginBottom: 8,
              }}
            >
              {logging === "single" ? "Ekleniyor..." : "Onayla ve Tek Log Ekle"}
            </button>
            <button
              onClick={() => logMeal("separate")}
              disabled={logging !== null || result.items.length === 0}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid #3f3f46",
                background: "#27272a",
                color: "#e4e4e7",
                fontWeight: 600,
                fontSize: 14,
                padding: "13px 0",
                cursor: logging !== null ? "not-allowed" : "pointer",
                opacity: logging !== null || result.items.length === 0 ? 0.5 : 1,
              }}
            >
              {logging === "separate" ? "Ekleniyor..." : "Her Yemegi Ayri Logla"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
