"use client";

import {
  useEffect,
  useState,
} from "react";

interface MealLog {
  id: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;

  meal: {
    name: string;
    mealType: string;
    isFavorite: boolean;
  };
}

interface DashboardData {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealLogs: MealLog[];
}

export default function DashboardPage() {
  const [data, setData] =
    useState<DashboardData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [calorieGoal,
    setCalorieGoal] =
    useState(2400);

  const [proteinGoal,
    setProteinGoal] =
    useState(170);

  async function fetchData() {
    const response =
      await fetch(
        "/api/dashboard"
      );

    const dashboard =
      await response.json();

    setData(
      dashboard
    );

    setLoading(
      false
    );
  }

  useEffect(() => {
    fetchData();

    const profile =
      localStorage.getItem(
        "profile"
      );

    if (profile) {
      const parsed =
        JSON.parse(
          profile
        );

      setCalorieGoal(
        Number(
          parsed.dailyCalories
        ) || 2400
      );

      setProteinGoal(
        Number(
          parsed.dailyProtein
        ) || 170
      );
    }
  }, []);

  async function removeMeal(
    id: string
  ) {
    await fetch(
      `/api/log-meal/${id}`,
      {
        method:
          "DELETE",
      }
    );

    fetchData();
  }

  if (
    loading ||
    !data
  ) {
    return (
      <main className="p-6">
        Loading...
      </main>
    );
  }

  const calorieProgress =
    Math.min(
      (data.totalCalories /
        calorieGoal) *
        100,
      100
    );

  const proteinProgress =
    Math.min(
      (data.totalProtein /
        proteinGoal) *
        100,
      100
    );

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          Dashboard
        </h1>

        <p className="text-zinc-400">
          Daily nutrition tracking
        </p>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-3 flex justify-between">
            <h2 className="font-semibold">
              Calories
            </h2>

            <span className="text-zinc-400">
              {
                data.totalCalories
              }
              /
              {
                calorieGoal
              }
            </span>
          </div>

          <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-green-500"
              style={{
                width: `${calorieProgress}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-3 flex justify-between">
            <h2 className="font-semibold">
              Protein
            </h2>

            <span className="text-zinc-400">
              {
                data.totalProtein
              }
              g /
              {
                proteinGoal
              }
              g
            </span>
          </div>

          <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-blue-500"
              style={{
                width: `${proteinProgress}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            Today's Meals
          </h2>

          <span className="text-sm text-zinc-500">
            {
              data.mealLogs
                .length
            }{" "}
            meals
          </span>
        </div>

        {!data.mealLogs
          .length ? (
          <p className="text-zinc-500">
            No meals today
          </p>
        ) : (
          <div className="space-y-4">
            {data.mealLogs.map(
              (
                mealLog
              ) => (
                <div
                  key={
                    mealLog.id
                  }
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {
                          mealLog
                            .meal
                            .name
                        }
                      </h3>

                      <p className="text-sm text-zinc-400">
                        {
                          mealLog
                            .meal
                            .mealType
                        }
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        removeMeal(
                          mealLog.id
                        )
                      }
                      className="rounded-xl bg-red-600 px-3 py-2"
                    >
                      🗑
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                      x
                      {
                        mealLog.quantity
                      }
                    </span>

                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                      {
                        mealLog.calories
                      }{" "}
                      kcal
                    </span>

                    <span className="rounded-full bg-blue-950 px-3 py-1 text-sm text-blue-300">
                      P:
                      {
                        mealLog.protein
                      }
                      g
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}