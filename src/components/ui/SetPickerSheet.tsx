"use client";

import { useState } from "react";
import { RulerPicker } from "@/components/ui/RulerPicker";

const WEIGHT_STEPS = [0.5, 1, 2.5, 5] as const;
const STEP_KEY = "fittrack-weight-step";

function readStep(): number {
  try {
    const v = Number(localStorage.getItem(STEP_KEY));
    return (WEIGHT_STEPS as readonly number[]).includes(v) ? v : 2.5;
  } catch {
    return 2.5;
  }
}

interface Props {
  exerciseName: string;
  setNumber: number;
  initialWeight: number;
  initialReps: number;
  /** e.g. "Last: 60kg × 8" */
  hint?: string;
  onApply: (weight: number, reps: number, addNextSet: boolean) => void;
  onClose: () => void;
}

export function SetPickerSheet({ exerciseName, setNumber, initialWeight, initialReps, hint, onApply, onClose }: Props) {
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [step, setStep] = useState(readStep);

  function chooseStep(s: number) {
    setStep(s);
    setWeight((w) => Number((Math.round(w / s) * s).toFixed(3)));
    try {
      localStorage.setItem(STEP_KEY, String(s));
    } catch {
      /* storage unavailable */
    }
  }

  const canApply = weight > 0 && reps > 0;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 pb-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">{exerciseName}</p>
            <p className="text-xs text-zinc-500">Set {setNumber}{hint ? ` · ${hint}` : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-white">✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <RulerPicker
              label="Weight"
              unit="kg"
              value={weight}
              min={0}
              max={400}
              step={step}
              majorEvery={step >= 2.5 ? Math.round(10 / step) : Math.round(5 / step)}
              onChange={setWeight}
            />
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-[11px] text-zinc-600">step</span>
              {WEIGHT_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => chooseStep(s)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    step === s ? "bg-green-600 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <RulerPicker label="Reps" unit="reps" value={reps} min={0} max={100} step={1} majorEvery={5} onChange={setReps} />
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => onApply(weight, reps, true)}
            disabled={!canApply}
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-800 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-green-600 disabled:opacity-40"
          >
            Save & next set
          </button>
          <button
            onClick={() => onApply(weight, reps, false)}
            disabled={!canApply}
            className="flex-1 rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-colors hover:bg-green-500 disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
