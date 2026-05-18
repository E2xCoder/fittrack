"use client";

import {
  useEffect,
  useState,
} from "react";

interface Exercise {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

export default function WorkoutPage() {
  const [
    exerciseName,
    setExerciseName,
  ] = useState("");

  const [sets,
    setSets] =
    useState("");

  const [reps,
    setReps] =
    useState("");

  const [weight,
    setWeight] =
    useState("");

  const [
    exercises,
    setExercises,
  ] = useState<
    Exercise[]
  >([]);

  useEffect(() => {
    loadWorkout();
  }, []);

  async function loadWorkout() {
    const response =
      await fetch(
        "/api/workouts"
      );

    const data =
      await response.json();

    if (
      data?.length >
      0
    ) {
      const latest =
        data[0];

      const mapped =
        latest.exercises.map(
          (
            exercise: any
          ) => ({
            id:
              Date.now() +
              Math.random(),

            name:
              exercise.name,

            sets:
              "1",

            reps:
              String(
                exercise
                  .sets?.[0]
                  ?.reps ??
                  ""
              ),

            weight:
              String(
                exercise
                  .sets?.[0]
                  ?.weight ??
                  ""
              ),
          })
        );

      setExercises(
        mapped
      );
    }
  }

  async function addExercise() {
    if (
      !exerciseName
    )
      return;

    const updated =
      [
        ...exercises,
        {
          id:
            Date.now(),

          name:
            exerciseName,

          sets,
          reps,
          weight,
        },
      ];

    setExercises(
      updated
    );

    await fetch(
      "/api/workouts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              title:
                "Workout",

              exercises:
                updated.map(
                  (
                    ex
                  ) => ({
                    name:
                      ex.name,

                    sets:
                      [
                        {
                          weight:
                            Number(
                              ex.weight
                            ),

                          reps:
                            Number(
                              ex.reps
                            ),
                        },
                      ],
                  })
                ),
            }
          ),
      }
    );

    setExerciseName(
      ""
    );

    setSets("");
    setReps("");
    setWeight("");

    loadWorkout();
  }

  async function removeExercise(
    id: number
  ) {
    const updated =
      exercises.filter(
        (
          exercise
        ) =>
          exercise.id !==
          id
      );

    setExercises(
      updated
    );

    await fetch(
      "/api/workouts",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              title:
                "Workout",

              exercises:
                updated.map(
                  (
                    ex
                  ) => ({
                    name:
                      ex.name,

                    sets:
                      [
                        {
                          weight:
                            Number(
                              ex.weight
                            ),

                          reps:
                            Number(
                              ex.reps
                            ),
                        },
                      ],
                  })
                ),
            }
          ),
      }
    );

    loadWorkout();
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          Workout
        </h1>

        <p className="text-zinc-400">
          Track your gym
        </p>
      </div>

      <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            placeholder="Exercise"
            value={
              exerciseName
            }
            onChange={(
              e
            ) =>
              setExerciseName(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            placeholder="Sets"
            value={sets}
            onChange={(
              e
            ) =>
              setSets(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            placeholder="Reps"
            value={reps}
            onChange={(
              e
            ) =>
              setReps(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            placeholder="Weight"
            value={weight}
            onChange={(
              e
            ) =>
              setWeight(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />
        </div>

        <button
          onClick={
            addExercise
          }
          className="mt-4 w-full rounded-2xl bg-green-600 py-3 font-semibold"
        >
          Add Exercise
        </button>
      </div>

      <div className="space-y-4">
        {exercises.map(
          (
            exercise
          ) => (
            <div
              key={
                exercise.id
              }
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {
                      exercise.name
                    }
                  </h2>

                  <p className="text-zinc-400">
                    {
                      exercise.sets
                    }{" "}
                    sets •{" "}
                    {
                      exercise.reps
                    }{" "}
                    reps •{" "}
                    {
                      exercise.weight
                    }{" "}
                    kg
                  </p>
                </div>

                <button
                  onClick={() =>
                    removeExercise(
                      exercise.id
                    )
                  }
                  className="rounded-xl bg-red-600 px-4 py-2"
                >
                  🗑
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}