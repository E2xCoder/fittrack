"use client";

import { useRef } from "react";

const PX_PER_STEP = 14;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const snap = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(3));

interface Props {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** A taller tick every N steps. */
  majorEvery?: number;
  onChange: (v: number) => void;
}

// A horizontal ruler you drag like a tape measure: the centre line is the
// value, dragging right lowers it, left raises it. The big number is also an
// input, so the keyboard is always one tap away.
export function RulerPicker({ label, unit, value, min, max, step, majorEvery = 5, onChange }: Props) {
  const drag = useRef<{ x: number; start: number } | null>(null);

  function move(clientX: number) {
    if (!drag.current) return;
    const dx = clientX - drag.current.x;
    const next = clamp(snap(drag.current.start - (dx / PX_PER_STEP) * step, step), min, max);
    if (next !== value) {
      onChange(next);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(4);
    }
  }

  function nudge(dir: 1 | -1) {
    onChange(clamp(snap(value + dir * step, step), min, max));
  }

  // A tick sits at the left edge of each background tile, and a % position
  // also subtracts the tile width, so add half a tile back to hit true centre.
  const offset = (value / step) * PX_PER_STEP;
  const minorPos = `calc(50% + ${PX_PER_STEP / 2}px - ${offset}px) 100%`;
  const majorPos = `calc(50% + ${(PX_PER_STEP * majorEvery) / 2}px - ${offset}px) 100%`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-[11px] text-zinc-600">drag the ruler</p>
      </div>

      <div className="mb-2 flex items-baseline justify-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          aria-label={label}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n, min, max));
          }}
          className="w-28 bg-transparent text-center text-5xl font-black tabular-nums text-white outline-none"
        />
        <span className="text-sm font-medium text-zinc-500">{unit}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => nudge(-1)}
          className="h-12 w-12 shrink-0 rounded-xl bg-zinc-800 text-xl font-bold text-zinc-300 active:bg-zinc-700"
        >
          −
        </button>

        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, start: value };
          }}
          onPointerMove={(e) => move(e.clientX)}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          className="relative h-14 flex-1 cursor-grab touch-none select-none overflow-hidden rounded-xl bg-zinc-800 active:cursor-grabbing"
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, #52525b 1px, transparent 1px), linear-gradient(to right, #d4d4d8 2px, transparent 2px)",
              backgroundSize: `${PX_PER_STEP}px 35%, ${PX_PER_STEP * majorEvery}px 62%`,
              backgroundRepeat: "repeat-x, repeat-x",
              backgroundPosition: `${minorPos}, ${majorPos}`,
            }}
          />
          <div aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-green-500" />
        </div>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => nudge(1)}
          className="h-12 w-12 shrink-0 rounded-xl bg-zinc-800 text-xl font-bold text-zinc-300 active:bg-zinc-700"
        >
          +
        </button>
      </div>
    </div>
  );
}
