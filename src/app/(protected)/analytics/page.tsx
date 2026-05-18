"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export default function AnalyticsPage() {
  const [data, setData] =
    useState<DashboardData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  async function fetchData() {
    try {
      const response =
        await fetch(
          "/api/dashboard"
        );

      const dashboard =
        await response.json();

      setData(
        dashboard
      );
    } catch (
      error
    ) {
      console.error(
        error
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="p-6">
        Loading...
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-6">
        Failed to load
      </main>
    );
  }

  const macros = [
    {
      name:
        "Calories",
      value:
        data.totalCalories,
      unit: "kcal",
    },
    {
      name:
        "Protein",
      value:
        data.totalProtein,
      unit: "g",
    },
    {
      name:
        "Carbs",
      value:
        data.totalCarbs,
      unit: "g",
    },
    {
      name:
        "Fat",
      value:
        data.totalFat,
      unit: "g",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          Analytics
        </h1>

        <p className="text-zinc-400">
          Daily nutrition stats
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {macros.map(
          (
            item
          ) => (
            <div
              key={
                item.name
              }
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
            >
              <p className="mb-2 text-zinc-400">
                {
                  item.name
                }
              </p>

              <h2 className="text-4xl font-bold">
                {
                  item.value
                }
                <span className="ml-1 text-lg text-zinc-500">
                  {
                    item.unit
                  }
                </span>
              </h2>
            </div>
          )
        )}
      </div>
    </main>
  );
}