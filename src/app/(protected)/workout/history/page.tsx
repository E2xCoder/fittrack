"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ExerciseSet {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  sets: number | null;
  rpe: number | null;
}

interface Exercise {
  id: string;
  name: string;
  sets: ExerciseSet[];
}

interface Workout {
  id: string;
  split: string;
  notes: string | null;
  date: string;
  createdAt: string;
  exercises: Exercise[];
}

export default function WorkoutHistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workouts")
      .then((r) => r.json())
      .then((data) => {
        setWorkouts(data);
        setLoading(false);
      });
  }, []);

  async function deleteWorkout(id: string) {
    await fetch(`/api/workouts/${id}`, { method: "DELETE" });
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }

  if (loading) {
    return (
      <main className="p-4">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
          ))}
        </div>
      </main>
    );
  }

  // Group by date
  const grouped = workouts.reduce((acc, workout) => {
    const date = new Date(workout.date).toLocaleDateString("en-CA", {
      timeZone: "Europe/Berlin",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(workout);
    return acc;
  }, {} as Record<string, Workout[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workout History</h1>
          <p className="text-sm text-zinc-400">{workouts.filter(w => w.split !== "Rest Day").length} sessions logged</p>
        </div>
        <Link href="/workout" className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-700">
          + Today
        </Link>
      </div>

      {sortedDates.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="font-semibold">No workouts yet</p>
          <p className="mt-1 text-sm text-zinc-500">Start logging your sessions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => {
            const dateWorkouts = grouped[date];
            const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long",
            });
            const isToday = date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });

            return (
              <div key={date}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-medium text-zinc-400">{displayDate}</p>
                  {isToday && <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-400">Today</span>}
                </div>

                <div className="space-y-2">
                  {dateWorkouts.map((workout) => {
                    const isExpanded = expanded === workout.id;
                    const isRestDay = workout.split === "Rest Day";
                    const totalSets = workout.exercises.reduce(
                      (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.sets ?? 1), 0), 0
                    );

                    return (
                      <div key={workout.id} className="rounded-2xl border border-zinc-800 bg-zinc-900">
                        <div
                          className="flex cursor-pointer items-center justify-between p-4"
                          onClick={() => setExpanded(isExpanded ? null : workout.id)}
                        >
                          <div>
                            <p className="font-semibold">
                              {isRestDay ? "😴 Rest Day" : `🏋️ ${workout.split}`}
                            </p>
                            {!isRestDay && (
                              <p className="text-xs text-zinc-500">
                                {workout.exercises.length} exercises · {totalSets} sets
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id); }}
                              className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-500 hover:bg-red-900 hover:text-red-300"
                            >🗑</button>
                            <span className="text-zinc-500 text-sm">{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {isExpanded && !isRestDay && workout.exercises.length > 0 && (
                          <div className="border-t border-zinc-800 p-4 space-y-4">
                            {workout.exercises.map((exercise) => (
                              <div key={exercise.id}>
                                <p className="mb-2 font-medium text-sm">{exercise.name}</p>
                                <div className="space-y-1">
                                  <div className="grid grid-cols-4 gap-2 text-xs text-zinc-500 px-1">
                                    <span>kg</span>
                                    <span>Reps</span>
                                    <span>Sets</span>
                                    <span>RPE</span>
                                  </div>
                                  {exercise.sets.map((set, i) => (
                                    <div key={i} className="grid grid-cols-4 gap-2 rounded-lg bg-zinc-800 px-2 py-1.5 text-sm">
                                      <span>{set.weight ?? "—"}</span>
                                      <span>{set.reps ?? "—"}</span>
                                      <span>{set.sets ?? 1}</span>
                                      <span>{set.rpe ?? "—"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {workout.notes && (
                              <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
                                📝 {workout.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}