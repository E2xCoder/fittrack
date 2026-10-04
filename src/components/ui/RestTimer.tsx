"use client";

import { useEffect, useRef, useState } from "react";
import { SEMANTIC } from "@/lib/metrics";

const PRESETS = [60, 90, 120, 180];

/**
 * Floating rest timer shown between sets. Configurable duration, dismissable,
 * and gives a subtle beep + vibration when the rest is over.
 */
export function RestTimer({
  initialDuration = 90,
  onClose,
}: {
  initialDuration?: number;
  onClose: () => void;
}) {
  const [duration, setDuration] = useState(initialDuration);
  const [remaining, setRemaining] = useState(initialDuration);
  const [done, setDone] = useState(false);
  const startRef = useRef(0);

  // Pick a new rest length and restart the countdown (event-handler driven, so
  // no synchronous setState-in-effect). The interval effect re-syncs the clock.
  function restart(next: number) {
    // The [duration] effect re-syncs startRef when setDuration lands.
    setDuration(next);
    setRemaining(next);
    setDone(false);
  }

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left === 0) {
        setDone(true);
        clearInterval(id);
        notifyRestOver();
      }
    }, 250);
    return () => clearInterval(id);
  }, [duration]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = duration > 0 ? ((duration - remaining) / duration) * 100 : 100;

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-2xl backdrop-blur md:bottom-6">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <svg width={48} height={48} className="-rotate-90">
          <circle cx={24} cy={24} r={20} fill="none" stroke="#27272a" strokeWidth={4} />
          <circle
            cx={24}
            cy={24}
            r={20}
            fill="none"
            stroke={done ? SEMANTIC.success : SEMANTIC.accent}
            strokeWidth={4}
            strokeDasharray={2 * Math.PI * 20}
            strokeDashoffset={(1 - pct / 100) * 2 * Math.PI * 20}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[11px] font-bold tabular-nums text-white">
          {done ? "✓" : `${mins}:${String(secs).padStart(2, "0")}`}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          {done ? "Rest over — let's go! 💪" : "Rest timer"}
        </p>
        <div className="mt-1 flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => restart(p)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                duration === p ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {p}s
            </button>
          ))}
        </div>
      </div>

      {!done && (
        <button
          onClick={() => restart(duration + 30)}
          aria-label="Add 30 seconds"
          className="shrink-0 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          +30s
        </button>
      )}
      <button
        onClick={onClose}
        aria-label="Dismiss rest timer"
        className="shrink-0 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700"
      >
        ✕
      </button>
    </div>
  );
}

function notifyRestOver() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([120, 60, 120]);
    }
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
    }
  } catch {
    // audio/vibrate not available — the visual "✓" is enough
  }
}
