"use client";

import { useEffect, useState } from "react";

type WorkoutSplit =
  | "ARMS_FOREARMS"
  | "SHOULDERS_TRICEPS"
  | "CHEST_BACK"
  | "LEGS_ABS"
  | "REST_DAY";

const SPLIT_LABELS: Record<WorkoutSplit, string> = {
  ARMS_FOREARMS: "💪 Arms & Forearms",
  SHOULDERS_TRICEPS: "🏋️ Shoulders & Triceps",
  CHEST_BACK: "🔥 Chest & Back",
  LEGS_ABS: "🦵 Legs & Abs",
  REST_DAY: "😴 Rest Day",
};

interface ExerciseSet {
  id?: string;
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  isPR?: boolean;
}

interface Exercise {
  id?: string;
  name: string;
  sets: ExerciseSet[];
}

interface PreviousPerformance {
  date: string;
  sets: { weight: number | null; reps: number | null }[];
}

export default function WorkoutPage() {
  const [split, setSplit] = useState<WorkoutSplit>("CHEST_BACK");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previousPerf, setPreviousPerf] = useState<Record<string, PreviousPerformance>>({});
  const [notes, setNotes] = useState("");

  function addExercise() {
    if (!newExerciseName.trim()) return;
    setExercises((prev) => [
      ...prev,
      {
        name: newExerciseName.trim(),
        sets: [{ setNumber: 1, weight: "", reps: "", rpe: "" }],
      },
    ]);
    fetchPrevious(newExerciseName.trim());
    setNewExerciseName("");
  }

  async function fetchPrevious(exerciseName: string) {
    const res = await fetch(
      `/api/workouts/previous?exercise=${encodeURIComponent(exerciseName)}`
    );
    const data = await res.json();
    if (data.previous) {
      setPreviousPerf((prev) => ({ ...prev, [exerciseName]: data.previous }));
    }
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = updated[exerciseIndex];
      const lastSet = exercise.sets[exercise.sets.length - 1];
      exercise.sets = [
        ...exercise.sets,
        {
          setNumber: exercise.sets.length + 1,
          weight: lastSet?.weight ?? "",
          reps: lastSet?.reps ?? "",
          rpe: "",
        },
      ];
      return updated;
    });
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex].sets = updated[exerciseIndex].sets
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      return updated;
    });
  }

  function updateSet(
    exerciseIndex: number,
    setIndex: number,
    field: keyof ExerciseSet,
    value: string
  ) {
    setExercises((prev) => {
      const updated = [...prev];
      (updated[exerciseIndex].sets[setIndex] as any)[field] = value;
      return updated;
    });
  }

  async function saveWorkout() {
    const hasData = exercises.some((ex) =>
      ex.sets.some((s) => s.weight || s.reps)
    );

    if (!hasData && split !== "REST_DAY") {
      alert("Add at least one set with weight or reps");
      return;
    }

    setSaving(true);

    await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        split,
        notes,
        exercises: exercises.map((ex, i) => ({
          name: ex.name,
          orderIndex: i,
          sets: ex.sets.map((s, j) => ({
            setNumber: j + 1,
            weight: Number(s.weight) || null,
            reps: Number(s.reps) || null,
            rpe: Number(s.rpe) || null,
          })),
        })),
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Workout</h1>
        <p className="text-sm text-zinc-400">Log today's session</p>
      </div>

      {/* Split selector */}
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-400">Today's split</p>
        <div className="grid grid-cols-1 gap-2">
          {(Object.entries(SPLIT_LABELS) as [WorkoutSplit, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSplit(value)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                split === value
                  ? "bg-green-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {split !== "REST_DAY" && (
        <>
          {/* Add exercise */}
          <div className="mb-6 flex gap-3">
            <input
              placeholder="Exercise name (e.g. Incline Bench)"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExercise()}
              className="flex-1 rounded-xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button
              onClick={addExercise}
              className="rounded-xl bg-green-600 px-4 font-semibold hover:bg-green-700"
            >
              + Add
            </button>
          </div>

          {/* Exercise list */}
          <div className="space-y-4">
            {exercises.map((exercise, exIdx) => {
              const prev = previousPerf[exercise.name];
              return (
                <div key={exIdx} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  {/* Exercise header */}
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{exercise.name}</h2>
                    <button
                      onClick={() => removeExercise(exIdx)}
                      className="text-xs text-zinc-500 hover:text-red-400"
                    >✕ Remove</button>
                  </div>

                  {/* Previous performance */}
                  {prev && (
                    <div className="mb-3 rounded-xl bg-zinc-800 px-3 py-2">
                      <p className="text-xs text-zinc-500 mb-1">
                        Last time · {new Date(prev.date).toLocaleDateString("en-GB")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {prev.sets.map((s, i) => (
                          <span key={i} className="text-xs text-zinc-300">
                            Set {i + 1}: {s.weight ?? "?"}kg × {s.reps ?? "?"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sets header */}
                  <div className="mb-2 grid grid-cols-4 gap-2 text-xs text-zinc-500 px-1">
                    <span>Set</span>
                    <span>Weight (kg)</span>
                    <span>Reps</span>
                    <span>RPE</span>
                  </div>

                  {/* Sets */}
                  <div className="space-y-2">
                    {exercise.sets.map((set, setIdx) => (
                      <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-zinc-400">
                            {set.setNumber}
                          </span>
                          {set.isPR && (
                            <span className="text-xs text-amber-400">🏆</span>
                          )}
                        </div>
                        <input
                          type="number"
                          placeholder="0"
                          value={set.weight}
                          onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)}
                          className="rounded-lg bg-zinc-800 p-2 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                        />
                        <input
                          type="number"
                          placeholder="0"
                          value={set.reps}
                          onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                          className="rounded-lg bg-zinc-800 p-2 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="1-10"
                            min="1"
                            max="10"
                            value={set.rpe}
                            onChange={(e) => updateSet(exIdx, setIdx, "rpe", e.target.value)}
                            className="w-full rounded-lg bg-zinc-800 p-2 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                          />
                          {exercise.sets.length > 1 && (
                            <button
                              onClick={() => removeSet(exIdx, setIdx)}
                              className="text-zinc-600 hover:text-red-400 text-xs"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add set */}
                  <button
                    onClick={() => addSet(exIdx)}
                    className="mt-3 w-full rounded-xl bg-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-700"
                  >
                    + Add Set
                  </button>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          {exercises.length > 0 && (
            <div className="mt-4">
              <textarea
                placeholder="Workout notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 p-3 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                rows={2}
              />
            </div>
          )}
        </>
      )}

      {split === "REST_DAY" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-4xl mb-3">😴</p>
          <p className="font-semibold">Rest Day</p>
          <p className="text-sm text-zinc-500 mt-1">Recovery is part of the process.</p>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={saveWorkout}
        disabled={saving}
        className={`mt-6 w-full rounded-xl py-3 font-semibold transition ${
          saved
            ? "bg-green-800 text-green-300"
            : "bg-green-600 hover:bg-green-700"
        } disabled:opacity-50`}
      >
        {saved ? "Saved ✓" : saving ? "Saving..." : "Save Workout"}
      </button>
    </main>
  );
}