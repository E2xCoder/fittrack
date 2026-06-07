"use client";

import { useEffect, useRef, useState } from "react";
import { searchExercises } from "@/lib/exercises";
import Link from "next/link";
import { posthog } from "@/lib/posthog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSplit {
  id: string;
  name: string;
  emoji: string;
}

interface ExerciseSet {
  setNumber: number;
  weight: string;
  reps: string;
  sets: string;
  rpe: string;
}

interface Exercise {
  name: string;
  sets: ExerciseSet[];
}

interface PreviousSet {
  weight: number | null;
  reps: number | null;
  sets: number | null;
  rpe: number | null;
}

interface PreviousPerformance {
  date: string;
  sets: PreviousSet[];
}

interface OverloadBest {
  weight: number;
  reps: number;
  volume: number;
}

interface OverloadData {
  lastWeekBest: OverloadBest | null;
  thisWeekBest: OverloadBest | null;
}

// ─── Colour palette per exercise index ───────────────────────────────────────

const ACCENT_COLORS = [
  { border: "#22c55e", glow: "#22c55e20", text: "text-green-400", ring: "focus:ring-green-800" },
  { border: "#60a5fa", glow: "#60a5fa20", text: "text-blue-400",  ring: "focus:ring-blue-800"  },
  { border: "#c084fc", glow: "#c084fc20", text: "text-purple-400",ring: "focus:ring-purple-800"},
  { border: "#fb923c", glow: "#fb923c20", text: "text-orange-400",ring: "focus:ring-orange-800"},
  { border: "#f472b6", glow: "#f472b620", text: "text-pink-400",  ring: "focus:ring-pink-800"  },
  { border: "#34d399", glow: "#34d39920", text: "text-emerald-400",ring:"focus:ring-emerald-800"},
];

function accentFor(i: number) {
  return ACCENT_COLORS[i % ACCENT_COLORS.length];
}

// ─── Compact input ────────────────────────────────────────────────────────────

function SetInput({
  value, placeholder, onChange, ringClass,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  ringClass: string;
}) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-7 w-full rounded-md border border-zinc-700 bg-zinc-800 text-center text-xs font-semibold text-white outline-none focus:ring-1 ${ringClass} placeholder:text-zinc-600`}
    />
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function suggestWeight(w: number): number {
  if (w <= 30) return w + 2;
  if (w <= 60) return w + 2.5;
  return w + 5;
}

function ExerciseCard({
  exercise,
  exIdx,
  prev,
  overload,
  onRemove,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
}: {
  exercise: Exercise;
  exIdx: number;
  prev?: PreviousPerformance;
  overload?: OverloadData;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onUpdateSet: (setIdx: number, field: keyof ExerciseSet, value: string) => void;
}) {
  const acc = accentFor(exIdx);

  const isPR =
    overload?.thisWeekBest &&
    overload?.lastWeekBest &&
    overload.thisWeekBest.volume > overload.lastWeekBest.volume;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
      style={{ boxShadow: `0 0 24px -8px ${acc.border}30`, borderLeftColor: acc.border, borderLeftWidth: 3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
        <div className="flex items-center gap-1 min-w-0">
          <span className={`text-[10px] font-bold ${acc.text}`}>#{exIdx + 1}</span>
          <span className="truncate text-xs font-bold text-white leading-tight">{exercise.name}</span>
        </div>
        <button
          onClick={onRemove}
          className="ml-1 shrink-0 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Progressive overload suggestion */}
      {isPR ? (
        <div className="mx-2 mb-1 rounded bg-green-950/60 px-1.5 py-0.5 border border-green-900/40">
          <span className="text-[9px] font-semibold text-green-400">PR! 🏆 {overload!.thisWeekBest!.weight}kg × {overload!.thisWeekBest!.reps}</span>
        </div>
      ) : overload?.lastWeekBest ? (
        <div className="mx-2 mb-1 rounded bg-zinc-800/50 px-1.5 py-0.5">
          <span className="text-[9px] text-zinc-400">
            Geçen: {overload.lastWeekBest.weight}kg×{overload.lastWeekBest.reps} → <span className="text-blue-400 font-semibold">{suggestWeight(overload.lastWeekBest.weight)}kg dene 💪</span>
          </span>
        </div>
      ) : null}

      {/* Previous perf */}
      {prev && !overload?.lastWeekBest && (
        <div className="mx-2 mb-1 rounded bg-zinc-800/50 px-1.5 py-0.5">
          <span className="text-[9px] text-zinc-500">
            Last: {prev.sets.slice(0,2).map((s, i) => `${s.weight ?? "?"}×${s.reps ?? "?"}`).join("  ")}
            {prev.sets.length > 2 ? "…" : ""}
          </span>
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_14px] gap-0.5 px-2 pb-0.5">
        {["kg", "Rep", "Set", "RPE", ""].map((h, i) => (
          <span key={i} className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
            {h}
          </span>
        ))}
      </div>

      {/* Set rows */}
      <div className="space-y-0.5 px-2 pb-1.5">
        {exercise.sets.map((set, setIdx) => (
          <div key={setIdx} className="grid grid-cols-[1fr_1fr_1fr_1fr_14px] items-center gap-0.5">
            <SetInput value={set.weight} placeholder="—" onChange={(v) => onUpdateSet(setIdx, "weight", v)} ringClass={acc.ring} />
            <SetInput value={set.reps}   placeholder="—" onChange={(v) => onUpdateSet(setIdx, "reps",   v)} ringClass={acc.ring} />
            <SetInput value={set.sets}   placeholder="1" onChange={(v) => onUpdateSet(setIdx, "sets",   v)} ringClass={acc.ring} />
            <SetInput value={set.rpe}    placeholder="—" onChange={(v) => onUpdateSet(setIdx, "rpe",    v)} ringClass={acc.ring} />
            <button
              onClick={() => onRemoveSet(setIdx)}
              className={`text-center text-[10px] leading-none transition-colors ${
                exercise.sets.length > 1 ? "text-zinc-700 hover:text-red-400" : "invisible"
              }`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add set */}
      <button
        onClick={onAddSet}
        className="w-full rounded-b-2xl bg-zinc-800/40 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
      >
        + add set
      </button>
    </div>
  );
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-2 animate-pulse">
      <div className="mb-2 h-3 w-2/3 rounded bg-zinc-800" />
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-4 gap-0.5">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-6 rounded-md bg-zinc-800" />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 h-5 rounded-b bg-zinc-800/60" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkoutPage() {
  const [splits, setSplits] = useState<UserSplit[]>([]);
  const [selectedSplit, setSelectedSplit] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [previousPerf, setPreviousPerf] = useState<Record<string, PreviousPerformance>>({});
  const [overloadData, setOverloadData] = useState<Record<string, OverloadData>>({});
  const [showSplitManager, setShowSplitManager] = useState(false);
  const [newSplitName, setNewSplitName] = useState("");
  const [newSplitEmoji, setNewSplitEmoji] = useState("🏋️");
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/workouts/init");
        const data = await res.json();
        const loadedSplits: UserSplit[] = data.splits ?? [];
        setSplits(loadedSplits);
        if (loadedSplits.length > 0) {
          const firstSplit = loadedSplits[0].name;
          setSelectedSplit(firstSplit);
          if (data.workout) {
            setNotes(data.workout.notes ?? "");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loaded = (data.workout.exercises ?? []).map((ex: any) => ({
              name: ex.name,
              sets: (ex.sets ?? []).length > 0
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? ex.sets.map((s: any) => ({
                    setNumber: s.setNumber,
                    weight: s.weight ? String(s.weight) : "",
                    reps: s.reps ? String(s.reps) : "",
                    sets: s.sets ? String(s.sets) : "1",
                    rpe: s.rpe ? String(s.rpe) : "",
                  }))
                : [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }],
            }));
            setExercises(loaded);
            loaded.forEach((ex: Exercise) => fetchOverload(ex.name));
          }
        }
      } catch {
        // init failed — page stays in empty state, user can still add exercises
      }
      initializedRef.current = true;
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSplits() {
    const res = await fetch("/api/splits");
    setSplits(await res.json());
  }

  async function createSplit() {
    if (!newSplitName.trim()) return;
    await fetch("/api/splits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSplitName, emoji: newSplitEmoji }),
    });
    setNewSplitName("");
    setNewSplitEmoji("🏋️");
    fetchSplits();
  }

  async function handleSplitSelect(splitName: string) {
    if (splitName === selectedSplit) return;
    // Optimistic: switch pill + show skeleton immediately
    setSelectedSplit(splitName);
    setExercises([]);
    setOverloadData({});
    setNotes("");
    setSplitLoading(true);
    try {
      const res = await fetch(`/api/workouts/init?split=${encodeURIComponent(splitName)}`);
      const data = await res.json();
      if (data.workout) {
        setNotes(data.workout.notes ?? "");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = (data.workout.exercises ?? []).map((ex: any) => ({
          name: ex.name,
          sets: (ex.sets ?? []).length > 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ex.sets.map((s: any) => ({
                setNumber: s.setNumber,
                weight: s.weight ? String(s.weight) : "",
                reps: s.reps ? String(s.reps) : "",
                sets: s.sets ? String(s.sets) : "1",
                rpe: s.rpe ? String(s.rpe) : "",
              }))
            : [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }],
        }));
        setExercises(loaded);
        loaded.forEach((ex: Exercise) => fetchOverload(ex.name));
      }
    } catch {
      // split fetch failed — exercises stay empty for this split
    }
    setSplitLoading(false);
  }

  async function deleteSplit(id: string) {
    await fetch(`/api/splits/${id}`, { method: "DELETE" });
    fetchSplits();
  }

  function handleExerciseInput(value: string) {
    setNewExerciseName(value);
    setSuggestions(searchExercises(value));
  }

  function selectSuggestion(name: string) {
    setNewExerciseName(name);
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function addExercise(name?: string) {
    const exerciseName = name ?? newExerciseName.trim();
    if (!exerciseName) return;
    setExercises((prev) => [
      ...prev,
      { name: exerciseName, sets: [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }] },
    ]);
    fetchPrevious(exerciseName);
    fetchOverload(exerciseName);
    setNewExerciseName("");
    setSuggestions([]);
  }

  async function fetchPrevious(exerciseName: string) {
    const res = await fetch(`/api/workouts/previous?exercise=${encodeURIComponent(exerciseName)}`);
    const data = await res.json();
    if (data.previous) {
      setPreviousPerf((prev) => ({ ...prev, [exerciseName]: data.previous }));
    }
  }

  async function fetchOverload(exerciseName: string) {
    try {
      const res = await fetch(`/api/workout/previous?exerciseName=${encodeURIComponent(exerciseName)}`);
      const data = await res.json();
      setOverloadData((prev) => ({ ...prev, [exerciseName]: data }));
    } catch {
      // overload fetch failed — badge just won't show for this exercise
    }
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function addSet(exIdx: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const last = updated[exIdx].sets[updated[exIdx].sets.length - 1];
      updated[exIdx].sets = [
        ...updated[exIdx].sets,
        { setNumber: updated[exIdx].sets.length + 1, weight: last?.weight ?? "", reps: last?.reps ?? "", sets: "1", rpe: "" },
      ];
      return updated;
    });
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exIdx].sets = updated[exIdx].sets
        .filter((_, i) => i !== setIdx)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      return updated;
    });
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof ExerciseSet, value: string) {
    setExercises((prev) => {
      const updated = [...prev];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updated[exIdx].sets[setIdx] as any)[field] = value;
      return updated;
    });
  }

  async function saveWorkout() {
    const isRestDay = selectedSplit === "Rest Day";
    const hasData = exercises.some((ex) => ex.sets.some((s) => s.weight || s.reps));
    if (!isRestDay && !hasData) {
      alert("Add at least one set with weight or reps");
      return;
    }
    setSaving(true);
    await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        split: selectedSplit,
        notes,
        exercises: exercises.map((ex, i) => ({
          name: ex.name,
          orderIndex: i,
          sets: ex.sets.map((s, j) => ({
            setNumber: j + 1,
            weight: Number(s.weight) || null,
            reps: Number(s.reps) || null,
            sets: Number(s.sets) || 1,
            rpe: Number(s.rpe) || null,
          })),
        })),
      }),
    });
    posthog.capture("workout_saved", { split: selectedSplit, exerciseCount: exercises.length });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const isRestDay = selectedSplit === "Rest Day";
  const selectedSplitObj = splits.find((s) => s.name === selectedSplit);

  return (
    <main className="mx-auto max-w-2xl p-4 pb-28">

      {/* ── Header ── */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Train</h1>
          <p className="text-xs text-zinc-500">Log today's session</p>
        </div>
        <div className="flex gap-1.5">
          <Link
            href="/workout/history"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            📋 History
          </Link>
          <button
            onClick={() => setShowSplitManager(!showSplitManager)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              showSplitManager
                ? "border-green-800 bg-green-950 text-green-400"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            ⚙️ Splits
          </button>
        </div>
      </div>

      {/* ── Split Manager ── */}
      {showSplitManager && (
        <div className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Manage Splits</p>
          <div className="mb-3 space-y-1.5">
            {splits.map((split) => (
              <div key={split.id} className="flex items-center justify-between rounded-xl bg-zinc-800 px-3 py-2">
                <span className="text-sm">{split.emoji} {split.name}</span>
                <button onClick={() => deleteSplit(split.id)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="🏋️"
              value={newSplitEmoji}
              onChange={(e) => setNewSplitEmoji(e.target.value)}
              className="w-14 rounded-xl bg-zinc-800 p-2 text-center text-lg outline-none"
            />
            <input
              placeholder="e.g. Push Day"
              value={newSplitName}
              onChange={(e) => setNewSplitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSplit()}
              className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600"
            />
            <button onClick={createSplit} className="rounded-xl bg-green-600 px-3 text-sm font-bold hover:bg-green-500 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Split pills ── */}
      <div style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: "8px", paddingBottom: "4px", WebkitOverflowScrolling: "touch" }} className="mb-4">
        {splits.map((split) => {
          const active = selectedSplit === split.name;
          return (
            <button
              key={split.id}
              onClick={() => handleSplitSelect(split.name)}
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                active
                  ? "bg-green-500 text-black shadow-lg shadow-green-500/30"
                  : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {split.emoji} {split.name}
            </button>
          );
        })}
      </div>

      {/* ── Active split banner ── */}
      {selectedSplitObj && !isRestDay && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2"
        >
          <span className="text-lg">{selectedSplitObj.emoji}</span>
          <div>
            <p className="text-xs font-bold text-zinc-200">{selectedSplitObj.name}</p>
            <p className="text-[10px] text-zinc-600">{exercises.length} exercise{exercises.length !== 1 ? "s" : ""} logged</p>
          </div>
        </div>
      )}

      {/* ── Rest Day ── */}
      {isRestDay && (
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 py-10 text-center">
          <p className="text-5xl">😴</p>
          <p className="mt-3 font-bold text-zinc-200">Rest Day</p>
          <p className="mt-1 text-sm text-zinc-500">Recovery is part of the process.</p>
        </div>
      )}

      {/* ── Exercise section ── */}
      {!isRestDay && (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">🔍</span>
                <input
                  ref={inputRef}
                  placeholder="Search exercise…"
                  value={newExerciseName}
                  onChange={(e) => handleExerciseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addExercise();
                    if (e.key === "Escape") setSuggestions([]);
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={() => addExercise()}
                className="rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-500 transition-colors shadow-lg shadow-green-900/40"
              >
                + Add
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
                {suggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => { selectSuggestion(s); addExercise(s); }}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {s}
                  </button>
                ))}
                {newExerciseName && !suggestions.includes(newExerciseName) && (
                  <button
                    onClick={() => addExercise(newExerciseName)}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm text-green-400 hover:bg-zinc-800 transition-colors border-t border-zinc-800"
                  >
                    + Add "{newExerciseName}" as custom
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Exercise cards — 2-column grid */}
          <div className="grid grid-cols-2 gap-2">
            {splitLoading
              ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
              : exercises.map((exercise, exIdx) => (
                  <ExerciseCard
                    key={exIdx}
                    exercise={exercise}
                    exIdx={exIdx}
                    prev={previousPerf[exercise.name]}
                    overload={overloadData[exercise.name]}
                    onRemove={() => removeExercise(exIdx)}
                    onAddSet={() => addSet(exIdx)}
                    onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
                    onUpdateSet={(setIdx, field, value) => updateSet(exIdx, setIdx, field, value)}
                  />
                ))
            }
          </div>

          {/* Notes */}
          {exercises.length > 0 && (
            <textarea
              placeholder="Workout notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
              rows={2}
            />
          )}
        </>
      )}

      {/* ── Save button ── */}
      <button
        onClick={saveWorkout}
        disabled={saving}
        className={`mt-5 w-full rounded-xl py-3 text-sm font-bold transition-all duration-300 disabled:opacity-50 ${
          saved
            ? "bg-green-900 text-green-300 shadow-none"
            : "bg-green-600 text-white shadow-lg shadow-green-900/40 hover:bg-green-500 hover:shadow-green-800/50"
        }`}
      >
        {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Workout"}
      </button>
    </main>
  );
}
