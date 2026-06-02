"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  name: string;
  goal: string;
  // Step 2
  height: string;
  weight: string;
  age: string;
  gender: string;
  // Step 3
  activityLevel: string;
  // Step 4
  dietaryPreferences: string[];
  mealsPerDay: number;
  // Step 5 (calculated + user-adjustable)
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  // Step 6
  gymDays: number;
  splits: { name: string; emoji: string }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GOALS = [
  { id: "lose_weight", label: "Kilo Ver", emoji: "🔥", desc: "Yağ yakarak form al" },
  { id: "muscle_gain", label: "Kas Kazan", emoji: "💪", desc: "Kas kütlesi artır" },
  { id: "maintain", label: "Form Koru", emoji: "⚖️", desc: "Mevcut formu koru" },
  { id: "bulk", label: "Bulk", emoji: "🏗️", desc: "Kalori fazlasıyla hacim al" },
];

const ACTIVITY_LEVELS = [
  { id: "sedentary",   label: "Sedanter",      emoji: "🛋️",  desc: "Masa başı iş, neredeyse hiç egzersiz yok" },
  { id: "light",       label: "Hafif Aktif",   emoji: "🚶",  desc: "Haftada 1-3 gün hafif egzersiz" },
  { id: "moderate",    label: "Orta Aktif",    emoji: "🏃",  desc: "Haftada 3-5 gün orta yoğunlukta egzersiz" },
  { id: "very_active", label: "Çok Aktif",     emoji: "⚡",  desc: "Haftada 6-7 gün yoğun egzersiz" },
  { id: "athlete",     label: "Sporcu",        emoji: "🏆",  desc: "Günde 2x antrenman veya profesyonel sporcu" },
];

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

const DIETARY = [
  { id: "normal",    label: "Normal",               emoji: "🍽️" },
  { id: "vegetarian",label: "Vejetaryen",           emoji: "🥦" },
  { id: "vegan",     label: "Vegan",                emoji: "🌱" },
  { id: "gluten_free",label: "Glutensiz",           emoji: "🌾" },
  { id: "lactose_free",label: "Laktoz İntoleranslı",emoji: "🥛" },
];

const DEFAULT_SPLITS: Record<number, { name: string; emoji: string }[]> = {
  3: [
    { name: "Push Day",  emoji: "🔴" },
    { name: "Pull Day",  emoji: "🔵" },
    { name: "Leg Day",   emoji: "🟢" },
  ],
  4: [
    { name: "Chest & Back",        emoji: "💪" },
    { name: "Shoulders & Triceps", emoji: "🏋️" },
    { name: "Legs",                emoji: "🦵" },
    { name: "Arms & Core",         emoji: "💥" },
  ],
  5: [
    { name: "Chest",      emoji: "🔴" },
    { name: "Back",       emoji: "🔵" },
    { name: "Shoulders",  emoji: "🟡" },
    { name: "Arms",       emoji: "🟣" },
    { name: "Legs",       emoji: "🟢" },
  ],
  6: [
    { name: "Push Day",  emoji: "🔴" },
    { name: "Pull Day",  emoji: "🔵" },
    { name: "Leg Day",   emoji: "🟢" },
    { name: "Push Day 2",emoji: "🔴" },
    { name: "Pull Day 2",emoji: "🔵" },
    { name: "Leg Day 2", emoji: "🟢" },
  ],
};

// ─── Macro Calculation ────────────────────────────────────────────────────────

function calculateMacros(data: Partial<FormData>) {
  const weight = Number(data.weight) || 75;
  const height = Number(data.height) || 175;
  const age    = Number(data.age)    || 25;
  const gender = data.gender || "male";
  const activity = data.activityLevel || "moderate";
  const goal   = data.goal || "maintain";

  // Mifflin-St Jeor BMR
  const bmr = gender === "male"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[activity] ?? 1.55));

  const goalAdjust: Record<string, number> = {
    lose_weight: -300,
    muscle_gain: -100,
    maintain: 0,
    bulk: +300,
  };

  const calories = Math.max(1200, tdee + (goalAdjust[goal] ?? 0));

  // Macros: protein 2g/kg, fat 25%, rest carbs
  const protein = Math.round(weight * 2);
  const fat     = Math.round((calories * 0.25) / 9);
  const carbs   = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories: Math.round(calories), protein, fat, carbs: Math.max(50, carbs) };
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex justify-between text-xs text-zinc-500">
        <span>Adım {step} / {total}</span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Option Card ─────────────────────────────────────────────────────────────

function OptionCard({
  emoji, label, desc, selected, onClick,
}: {
  emoji: string; label: string; desc?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-green-500 bg-green-500/10 shadow-lg shadow-green-500/10"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <p className={`font-semibold ${selected ? "text-green-400" : "text-white"}`}>{label}</p>
          {desc && <p className="text-xs text-zinc-500">{desc}</p>}
        </div>
        {selected && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
            <span className="text-[10px] text-black font-bold">✓</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Input Field ─────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", unit, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; unit?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-zinc-400">{label}</label>
      <div className="flex items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 focus-within:border-green-600">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600"
        />
        {unit && <span className="pr-4 text-sm text-zinc-500">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#22c55e","#60a5fa","#f59e0b","#f87171","#c084fc","#34d399"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      r: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 5,
    }));

    let raf: number;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    const timer = setTimeout(() => cancelAnimationFrame(raf), 5000);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function Step1({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 text-6xl">👋</div>
        <h2 className="text-2xl font-black text-white">Hoş geldin!</h2>
        <p className="mt-2 text-zinc-400">Sana özel bir plan oluşturalım.</p>
      </div>
      <Field
        label="Adın ne?"
        value={data.name}
        onChange={(v) => update({ name: v })}
        placeholder="Adın"
      />
      <div>
        <p className="mb-3 text-xs font-semibold text-zinc-400">Hedefin nedir?</p>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <OptionCard
              key={g.id}
              emoji={g.emoji}
              label={g.label}
              desc={g.desc}
              selected={data.goal === g.id}
              onClick={() => update({ goal: g.id })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step2({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  const h = Number(data.height) || 0;
  const w = Number(data.weight) || 0;
  const bmi = h > 0 && w > 0 ? w / ((h / 100) ** 2) : 0;
  const bmiColor = bmi < 18.5 ? "text-blue-400" : bmi < 25 ? "text-green-400" : bmi < 30 ? "text-amber-400" : "text-red-400";
  const bmiLabel = bmi < 18.5 ? "Zayıf" : bmi < 25 ? "Normal" : bmi < 30 ? "Fazla Kilolu" : "Obez";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">Vücut Bilgilerin</h2>
        <p className="mt-1 text-sm text-zinc-400">Kalori hesabı için kullanılacak.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Boy" value={data.height} onChange={(v) => update({ height: v })} type="number" unit="cm" placeholder="175" />
        <Field label="Kilo" value={data.weight} onChange={(v) => update({ weight: v })} type="number" unit="kg" placeholder="75" />
        <Field label="Yaş" value={data.age} onChange={(v) => update({ age: v })} type="number" unit="yıl" placeholder="25" />
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Cinsiyet</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: "male", label: "Erkek", emoji: "♂️" }, { id: "female", label: "Kadın", emoji: "♀️" }].map((g) => (
              <button
                key={g.id}
                onClick={() => update({ gender: g.id })}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                  data.gender === g.id ? "border-green-500 bg-green-500/10 text-green-400" : "border-zinc-800 bg-zinc-900 text-zinc-400"
                }`}
              >
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {bmi > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs text-zinc-500">Vücut Kitle İndeksi (BMI)</p>
          <p className={`mt-1 text-4xl font-black ${bmiColor}`}>{bmi.toFixed(1)}</p>
          <p className={`text-sm font-semibold ${bmiColor}`}>{bmiLabel}</p>
        </div>
      )}
    </div>
  );
}

function Step3({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">Aktivite Seviyesi</h2>
        <p className="mt-1 text-sm text-zinc-400">Günlük kalori hesabını etkiler.</p>
      </div>
      <div className="space-y-2">
        {ACTIVITY_LEVELS.map((a) => (
          <OptionCard
            key={a.id}
            emoji={a.emoji}
            label={a.label}
            desc={a.desc}
            selected={data.activityLevel === a.id}
            onClick={() => update({ activityLevel: a.id })}
          />
        ))}
      </div>
    </div>
  );
}

function Step4({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  const toggleDiet = (id: string) => {
    const current = data.dietaryPreferences;
    if (id === "normal") {
      update({ dietaryPreferences: ["normal"] });
      return;
    }
    const withoutNormal = current.filter((d) => d !== "normal");
    if (withoutNormal.includes(id)) {
      update({ dietaryPreferences: withoutNormal.filter((d) => d !== id) });
    } else {
      update({ dietaryPreferences: [...withoutNormal, id] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">Beslenme Tercihleri</h2>
        <p className="mt-1 text-sm text-zinc-400">Birden fazla seçebilirsin.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DIETARY.map((d) => {
          const selected = data.dietaryPreferences.includes(d.id);
          return (
            <button
              key={d.id}
              onClick={() => toggleDiet(d.id)}
              className={`rounded-2xl border p-3 text-left transition-all ${
                selected ? "border-green-500 bg-green-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
              }`}
            >
              <p className="text-xl">{d.emoji}</p>
              <p className={`mt-1 text-sm font-semibold ${selected ? "text-green-400" : "text-zinc-300"}`}>{d.label}</p>
            </button>
          );
        })}
      </div>
      <div>
        <p className="mb-3 text-xs font-semibold text-zinc-400">Günlük kaç öğün?</p>
        <div className="flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => update({ mealsPerDay: n })}
              className={`flex-1 rounded-xl border py-3 text-lg font-black transition-all ${
                data.mealsPerDay === n
                  ? "border-green-500 bg-green-500/10 text-green-400"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step5({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  const total = data.calorieTarget;
  const pCal  = data.proteinTarget * 4;
  const cCal  = data.carbTarget    * 4;
  const fCal  = data.fatTarget     * 9;

  const handleSlider = (field: "proteinTarget" | "carbTarget" | "fatTarget", val: number) => {
    update({ [field]: val });
  };

  const pct = (v: number, total: number) => total > 0 ? Math.round((v / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">Kalori & Makro Hedeflerin</h2>
        <p className="mt-1 text-sm text-zinc-400">Mifflin-St Jeor formülüyle hesaplandı. İstersen değiştirebilirsin.</p>
      </div>

      {/* Calorie card */}
      <div className="rounded-2xl border border-green-900/40 bg-green-950/20 p-4 text-center">
        <p className="text-xs text-green-600">Günlük Kalori Hedefi</p>
        <div className="flex items-center justify-center gap-3 mt-1">
          <button onClick={() => update({ calorieTarget: Math.max(1200, total - 50) })}
            className="rounded-lg bg-zinc-800 px-3 py-1 text-lg font-bold text-zinc-400 hover:bg-zinc-700">−</button>
          <p className="text-5xl font-black text-green-400">{total}</p>
          <button onClick={() => update({ calorieTarget: total + 50 })}
            className="rounded-lg bg-zinc-800 px-3 py-1 text-lg font-bold text-zinc-400 hover:bg-zinc-700">+</button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">kcal / gün</p>
      </div>

      {/* Macro sliders */}
      <div className="space-y-4">
        {[
          { key: "proteinTarget" as const, label: "Protein", unit: "g", color: "#60a5fa", cal: pCal, val: data.proteinTarget, max: 300 },
          { key: "carbTarget"   as const, label: "Karbonhidrat", unit: "g", color: "#fbbf24", cal: cCal, val: data.carbTarget, max: 500 },
          { key: "fatTarget"    as const, label: "Yağ", unit: "g", color: "#f87171", cal: fCal, val: data.fatTarget, max: 200 },
        ].map(({ key, label, unit, color, cal, val, max }) => (
          <div key={key}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span style={{ color }} className="font-semibold">{label}</span>
              <span className="text-zinc-400">
                <span style={{ color }} className="font-bold">{val}{unit}</span>
                <span className="text-zinc-600 ml-1">({pct(cal, total * 4)}% · {cal} kcal)</span>
              </span>
            </div>
            <input
              type="range" min={0} max={max} value={val}
              onChange={(e) => handleSlider(key, Number(e.target.value))}
              className="w-full accent-green-500"
              style={{ accentColor: color }}
            />
          </div>
        ))}
      </div>

      {/* Macro bars */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <p className="mb-2 text-xs text-zinc-500">Makro Dağılımı</p>
        <div className="h-3 flex rounded-full overflow-hidden gap-0.5">
          {[
            { w: pct(pCal, pCal + cCal + fCal), color: "#60a5fa" },
            { w: pct(cCal, pCal + cCal + fCal), color: "#fbbf24" },
            { w: pct(fCal, pCal + cCal + fCal), color: "#f87171" },
          ].map((s, i) => (
            <div key={i} className="h-full rounded-sm transition-all duration-300"
              style={{ width: `${s.w}%`, backgroundColor: s.color }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px]">
          <span className="text-blue-400">P {pct(pCal, pCal + cCal + fCal)}%</span>
          <span className="text-amber-400">K {pct(cCal, pCal + cCal + fCal)}%</span>
          <span className="text-red-400">Y {pct(fCal, pCal + cCal + fCal)}%</span>
        </div>
      </div>
    </div>
  );
}

function Step6({ data, update }: { data: FormData; update: (d: Partial<FormData>) => void }) {
  const handleGymDays = (days: number) => {
    const presets = DEFAULT_SPLITS[days] ?? DEFAULT_SPLITS[3];
    update({ gymDays: days, splits: presets });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">Antrenman Tercihleri</h2>
        <p className="mt-1 text-sm text-zinc-400">Varsayılan split'ler otomatik oluşturulacak.</p>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold text-zinc-400">Haftada kaç gün gym?</p>
        <div className="grid grid-cols-5 gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => handleGymDays(n)}
              className={`rounded-xl border py-3 text-lg font-black transition-all ${
                data.gymDays === n
                  ? "border-green-500 bg-green-500/10 text-green-400 shadow-lg shadow-green-500/20"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {data.splits.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold text-zinc-400">Oluşturulacak split'ler</p>
          <div className="space-y-2">
            {data.splits.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5">
                <input
                  value={s.emoji}
                  onChange={(e) => {
                    const updated = [...data.splits];
                    updated[i] = { ...updated[i], emoji: e.target.value };
                    update({ splits: updated });
                  }}
                  className="w-10 bg-transparent text-center text-lg outline-none"
                />
                <input
                  value={s.name}
                  onChange={(e) => {
                    const updated = [...data.splits];
                    updated[i] = { ...updated[i], name: e.target.value };
                    update({ splits: updated });
                  }}
                  className="flex-1 bg-transparent text-sm font-semibold text-white outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step7({ data }: { data: FormData }) {
  return (
    <div className="space-y-5 text-center">
      <Confetti />
      <div className="text-6xl">🎉</div>
      <div>
        <h2 className="text-2xl font-black text-white">
          Hazırsın{data.name ? `, ${data.name}` : ""}!
        </h2>
        <p className="mt-2 text-zinc-400">İşte planının özeti</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Hedef</p>
          <p className="font-bold text-white">{GOALS.find(g => g.id === data.goal)?.emoji} {GOALS.find(g => g.id === data.goal)?.label ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Kalori</p>
          <p className="font-bold text-green-400">{data.calorieTarget} kcal</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Protein / Karb / Yağ</p>
          <p className="text-xs font-bold text-white">
            <span className="text-blue-400">{data.proteinTarget}g</span>
            {" / "}
            <span className="text-amber-400">{data.carbTarget}g</span>
            {" / "}
            <span className="text-red-400">{data.fatTarget}g</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Gym</p>
          <p className="font-bold text-white">Haftada {data.gymDays} gün</p>
        </div>
      </div>

      {data.splits.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left">
          <p className="mb-2 text-xs text-zinc-500">Split Programı</p>
          <div className="flex flex-wrap gap-2">
            {data.splits.map((s, i) => (
              <span key={i} className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
                {s.emoji} {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const [form, setForm] = useState<FormData>({
    name: "",
    goal: "",
    height: "",
    weight: "",
    age: "",
    gender: "male",
    activityLevel: "moderate",
    dietaryPreferences: ["normal"],
    mealsPerDay: 3,
    calorieTarget: 2400,
    proteinTarget: 150,
    carbTarget: 240,
    fatTarget: 70,
    gymDays: 3,
    splits: DEFAULT_SPLITS[3],
  });

  const update = (partial: Partial<FormData>) => {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      // Recalculate macros whenever body/activity/goal data changes
      if (
        "height" in partial || "weight" in partial || "age" in partial ||
        "gender" in partial || "activityLevel" in partial || "goal" in partial
      ) {
        const calc = calculateMacros(next);
        return { ...next, ...calc };
      }
      return next;
    });
  };

  // Check if already onboarded
  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((u) => { if (u?.onboardingCompleted) router.replace("/dashboard"); })
      .catch(() => {});
  }, [router]);

  const goNext = () => {
    setDirection("forward");
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 1));
  };

  const canNext = (): boolean => {
    if (step === 1) return !!form.goal;
    if (step === 2) return !!form.height && !!form.weight && !!form.age;
    if (step === 3) return !!form.activityLevel;
    if (step === 4) return form.dietaryPreferences.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      router.replace("/dashboard");
    } catch {
      setSaving(false);
    }
  };

  const stepProps = { data: form, update };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-xl font-black text-green-400">FitTrack</span>
        </div>

        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Step content */}
        <div
          key={step}
          className={`transition-all duration-300 ${
            direction === "forward"
              ? "animate-in slide-in-from-right-8 fade-in"
              : "animate-in slide-in-from-left-8 fade-in"
          }`}
        >
          {step === 1 && <Step1 {...stepProps} />}
          {step === 2 && <Step2 {...stepProps} />}
          {step === 3 && <Step3 {...stepProps} />}
          {step === 4 && <Step4 {...stepProps} />}
          {step === 5 && <Step5 {...stepProps} />}
          {step === 6 && <Step6 {...stepProps} />}
          {step === 7 && <Step7 data={form} />}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={goBack}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              ← Geri
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={goNext}
              disabled={!canNext()}
              className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/40 hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === 6 ? "Hesapla ve Devam Et →" : "Devam Et →"}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/40 hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              {saving ? "Kaydediliyor…" : "🚀 Hadi Başlayalım!"}
            </button>
          )}
        </div>

        {/* Skip */}
        {step === 1 && (
          <button
            onClick={() => router.replace("/dashboard")}
            className="mt-4 w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Şimdilik atla
          </button>
        )}
      </div>
    </div>
  );
}
