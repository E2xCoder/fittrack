"use client";

import {
  useEffect,
  useState,
} from "react";

export default function ProfilePage() {
  const [name,
    setName] =
    useState("");

  const [goal,
    setGoal] =
    useState(
      "Lean Bulk"
    );

  const [weight,
    setWeight] =
    useState("");

  const [targetWeight,
    setTargetWeight] =
    useState("");

  const [dailyCalories,
    setDailyCalories] =
    useState("");

  const [dailyProtein,
    setDailyProtein] =
    useState("");

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "profile"
      );

    if (saved) {
      const profile =
        JSON.parse(
          saved
        );

      setName(
        profile.name ||
          ""
      );

      setGoal(
        profile.goal ||
          "Lean Bulk"
      );

      setWeight(
        profile.weight ||
          ""
      );

      setTargetWeight(
        profile.targetWeight ||
          ""
      );

      setDailyCalories(
        profile.dailyCalories ||
          ""
      );

      setDailyProtein(
        profile.dailyProtein ||
          ""
      );
    }
  }, []);

  function saveProfile() {
    localStorage.setItem(
      "profile",
      JSON.stringify({
        name,
        goal,
        weight,
        targetWeight,
        dailyCalories,
        dailyProtein,
      })
    );

    alert(
      "Profile saved"
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          Profile
        </h1>

        <p className="text-zinc-400">
          Personal fitness settings
        </p>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <input
            placeholder="Name"
            value={name}
            onChange={(
              e
            ) =>
              setName(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <select
            value={goal}
            onChange={(
              e
            ) =>
              setGoal(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          >
            <option>
              Lean Bulk
            </option>

            <option>
              Cut
            </option>

            <option>
              Maintain
            </option>
          </select>

          <input
            type="number"
            placeholder="Current Weight"
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

          <input
            type="number"
            placeholder="Target Weight"
            value={
              targetWeight
            }
            onChange={(
              e
            ) =>
              setTargetWeight(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            placeholder="Daily Calories"
            value={
              dailyCalories
            }
            onChange={(
              e
            ) =>
              setDailyCalories(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            placeholder="Daily Protein"
            value={
              dailyProtein
            }
            onChange={(
              e
            ) =>
              setDailyProtein(
                e.target
                  .value
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />
        </div>

        <button
          onClick={
            saveProfile
          }
          className="mt-6 w-full rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700"
        >
          Save Profile
        </button>
      </div>
    </main>
  );
}