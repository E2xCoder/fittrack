"use client";

import { useEffect, useRef, useState } from "react";
import { searchExercises } from "@/lib/exercises";

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

export default function WorkoutPage() {
  const [splits, setSplits] = useState<UserSplit[]>([]);
  const [selectedSplit, setSelectedSplit] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [previousPerf, setPreviousPerf] = useState<Record<string, PreviousPerformance>>({});
  const [showSplitManager, setShowSplitManager] = useState(false);
  const [newSplitName, setNewSplitName] = useState("");
  const [newSplitEmoji, setNewSplitEmoji] = useState("🏋️");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSplits(); }, []);

  useEffect(() => {
    if (splits.length > 0) loadTodayWorkout();
  }, [splits]);

  async function fetchSplits() {
    const res = await fetch("/api/splits");
    const data = await res.json();
    setSplits(data);
    if (data.length > 0) setSelectedSplit(data[0].name);
  }

  async function loadTodayWorkout() {
    const res = await fetch(`/api/workouts/today?split=${encodeURIComponent(selectedSplit)}`);
    const data = await res.json();
    if (data.workout) {
      setNotes(data.workout.notes ?? "");
      setExercises(
        data.workout.exercises.map((ex: any) => ({
          name: ex.name,
          sets: ex.sets.length > 0
            ? ex.sets.map((s: any) => ({
                setNumber: s.setNumber,
                weight: s.weight ? String(s.weight) : "",
                reps: s.reps ? String(s.reps) : "",
                sets: s.sets ? String(s.sets) : "1",
                rpe: s.rpe ? String(s.rpe) : "",
              }))
            : [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }],
        }))
      );
    }
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
    setSelectedSplit(splitName);
    setExercises([]);
    setNotes("");
    const res = await fetch(`/api/workouts/today?split=${encodeURIComponent(splitName)}`);
    const data = await res.json();
    if (data.workout) {
      setNotes(data.workout.notes ?? "");
      setExercises(
        data.workout.exercises.map((ex: any) => ({
          name: ex.name,
          sets: ex.sets.length > 0
            ? ex.sets.map((s: any) => ({
                setNumber: s.setNumber,
                weight: s.weight ? String(s.weight) : "",
                reps: s.reps ? String(s.reps) : "",
                sets: s.sets ? String(s.sets) : "1",
                rpe: s.rpe ? String(s.rpe) : "",
              }))
            : [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }],
        }))
      );
    }
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

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isRestDay = selectedSplit === "Rest Day";

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workout</h1>
          <p className="text-sm text-zinc-400">Log today's session</p>
        </div>
        <button
          onClick={() => setShowSplitManager(!showSplitManager)}
          className="rounded-xl bg-zinc-800 px-3 py-2 text-xs hover:bg-zinc-700"
        >
          ⚙️ Manage Splits
        </button>
      </div>

      {showSplitManager && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-semibold">Manage Splits</h2>
          <div className="mb-3 space-y-2">
            {splits.map((split) => (
              <div key={split.id} className="flex items-center justify-between rounded-xl bg-zinc-800 px-3 py-2">
                <span className="text-sm">{split.emoji} {split.name}</span>
                <button onClick={() => deleteSplit(split.id)} className="text-xs text-zinc-500 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Emoji"
              value={newSplitEmoji}
              onChange={(e) => setNewSplitEmoji(e.target.value)}
              className="w-16 rounded-xl bg-zinc-800 p-2 text-center outline-none"
            />
            <input
              placeholder="Split name (e.g. Push Day)"
              value={newSplitName}
              onChange={(e) => setNewSplitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSplit()}
              className="flex-1 rounded-xl bg-zinc-800 p-2 outline-none"
            />
            <button onClick={createSplit} className="rounded-xl bg-green-600 px-3 text-sm font-semibold hover:bg-green-700">
              + Add
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-400">Today's split</p>
        <div className="grid grid-cols-1 gap-2">
          {splits.map((split) => (
            <button
              key={split.id}
              onClick={() => handleSplitSelect(split.name)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                selectedSplit === split.name
                  ? "bg-green-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {split.emoji} {split.name}
            </button>
          ))}
        </div>
      </div>

      {!isRestDay && (
        <>
          <div className="relative mb-6">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                placeholder="Search exercise (e.g. Incline Bench)"
                value={newExerciseName}
                onChange={(e) => handleExerciseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addExercise();
                  if (e.key === "Escape") setSuggestions([]);
                }}
                className="flex-1 rounded-xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
              />
              <button onClick={() => addExercise()} className="rounded-xl bg-green-600 px-4 font-semibold hover:bg-green-700">
                + Add
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => selectSuggestion(suggestion)}
                    className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-zinc-800"
                  >
                    {suggestion}
                  </button>
                ))}
                {newExerciseName && !suggestions.includes(newExerciseName) && (
                  <button
                    onClick={() => addExercise(newExerciseName)}
                    className="flex w-full items-center px-4 py-3 text-left text-sm text-green-400 hover:bg-zinc-800"
                  >
                    + Add "{newExerciseName}" as custom exercise
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {exercises.map((exercise, exIdx) => {
              const prev = previousPerf[exercise.name];
              return (
                <div key={exIdx} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{exercise.name}</h2>
                    <button onClick={() => removeExercise(exIdx)} className="text-xs text-zinc-500 hover:text-red-400">
                      ✕ Remove
                    </button>
                  </div>

                  {prev && (
                    <div className="mb-3 rounded-xl bg-zinc-800 px-3 py-2">
                      <p className="mb-1 text-xs text-zinc-500">
                        Last · {new Date(prev.date).toLocaleDateString("en-GB")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {prev.sets.map((s, i) => (
                          <span key={i} className="text-xs text-zinc-300">
                            {s.weight ?? "?"}kg × {s.reps ?? "?"} reps × {s.sets ?? 1} sets
                            {s.rpe && ` @${s.rpe}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-2 grid grid-cols-4 gap-2 px-1 text-xs text-zinc-500">
                    <span>kg</span>
                    <span>Reps</span>
                    <span>Sets</span>
                    <span>RPE</span>
                  </div>

                  {/* Rows */}
                  <div className="space-y-2">
                    {exercise.sets.map((set, setIdx) => (
                      <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
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
                        <input
                          type="number"
                          placeholder="1"
                          value={set.sets}
                          onChange={(e) => updateSet(exIdx, setIdx, "sets", e.target.value)}
                          className="rounded-lg bg-zinc-800 p-2 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                        />
                        <div className="flex gap-1">
                          <input
                            type="number"
                            placeholder="—"
                            min="1"
                            max="10"
                            value={set.rpe}
                            onChange={(e) => updateSet(exIdx, setIdx, "rpe", e.target.value)}
                            className="w-full rounded-lg bg-zinc-800 p-2 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                          />
                          {exercise.sets.length > 1 && (
                            <button
                              onClick={() => removeSet(exIdx, setIdx)}
                              className="px-1 text-xs text-zinc-600 hover:text-red-400"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addSet(exIdx)}
                    className="mt-3 w-full rounded-xl bg-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-700"
                  >
                    + Add Variation
                  </button>
                </div>
              );
            })}
          </div>

          {exercises.length > 0 && (
            <textarea
              placeholder="Workout notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-4 w-full rounded-xl bg-zinc-900 p-3 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
              rows={2}
            />
          )}
        </>
      )}

      {isRestDay && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="mb-3 text-4xl">😴</p>
          <p className="font-semibold">Rest Day</p>
          <p className="mt-1 text-sm text-zinc-500">Recovery is part of the process.</p>
        </div>
      )}

      <button
        onClick={saveWorkout}
        disabled={saving}
        className={`mt-6 w-full rounded-xl py-3 font-semibold transition ${
          saved ? "bg-green-800 text-green-300" : "bg-green-600 hover:bg-green-700"
        } disabled:opacity-50`}
      >
        {saved ? "Saved ✓" : saving ? "Saving..." : "Save Workout"}
      </button>
    </main>
  );
}