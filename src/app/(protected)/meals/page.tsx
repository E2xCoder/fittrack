"use client";

import { useEffect, useMemo, useState } from "react";

type MealType =
  | "BREAKFAST"
  | "LUNCH"
  | "DINNER"
  | "SNACK"
  | "SHAKE";

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  servingSize: number;
  servingLabel: string;
  mealType: MealType;
  isFavorite: boolean;
}

const presets = [
  {
    name: "Standard Breakfast",
    mealType: "BREAKFAST",
  },
  {
    name: "Protein Shake",
    mealType: "SHAKE",
  },
  {
    name: "Chicken Rice",
    mealType: "DINNER",
  },
];

export default function MealsPage() {
  const [meals, setMeals] =
    useState<Meal[]>([]);

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<
      MealType | "ALL"
    >("ALL");

  const [editingId,
    setEditingId] =
    useState<
      string | null
    >(null);

  const [quantities,
    setQuantities] =
    useState<
      Record<string, number>
    >({});

  const [form, setForm] =
    useState({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      fiber: "",
      sodium: "",
      servingSize: "1",
      servingLabel:
        "serving",
      mealType:
        "SNACK" as MealType,
      isFavorite:
        false,
    });

  async function fetchMeals() {
    const response =
      await fetch(
        "/api/meals"
      );

    const data =
      await response.json();

    setMeals(data);
  }

  useEffect(() => {
    fetchMeals();
  }, []);

  async function saveMeal() {
    if (
      !form.name ||
      !form.calories
    ) {
      alert(
        "Fill required fields"
      );
      return;
    }

    const method =
      editingId
        ? "PUT"
        : "POST";

    const url =
      editingId
        ? `/api/meals/${editingId}`
        : "/api/meals";

    await fetch(url, {
      method,
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(
        form
      ),
    });

    resetForm();
    fetchMeals();
  }

  async function deleteMeal(
    id: string
  ) {
    await fetch(
      `/api/meals/${id}`,
      {
        method:
          "DELETE",
      }
    );

    fetchMeals();
  }

  async function toggleFavorite(
    meal: Meal
  ) {
    await fetch(
      `/api/meals/${meal.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          ...meal,
          isFavorite:
            !meal.isFavorite,
        }),
      }
    );

    fetchMeals();
  }

  async function addMealToday(
    mealId: string
  ) {
    const quantity =
      quantities[
        mealId
      ] || 1;

    await fetch(
      "/api/log-meal",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          mealId,
          quantity,
        }),
      }
    );

    alert(
      `Added ${quantity}x meal`
    );
  }

  function editMeal(
    meal: Meal
  ) {
    setEditingId(
      meal.id
    );

    setForm({
      name: meal.name,
      calories:
        String(
          meal.calories
        ),
      protein:
        String(
          meal.protein
        ),
      carbs: String(
        meal.carbs
      ),
      fat: String(
        meal.fat
      ),
      fiber:
        String(
          meal.fiber ??
            ""
        ),
      sodium:
        String(
          meal.sodium ??
            ""
        ),
      servingSize:
        String(
          meal.servingSize
        ),
      servingLabel:
        meal.servingLabel,
      mealType:
        meal.mealType,
      isFavorite:
        meal.isFavorite,
    });

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  function resetForm() {
    setEditingId(
      null
    );

    setForm({
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      fiber: "",
      sodium: "",
      servingSize: "1",
      servingLabel:
        "serving",
      mealType:
        "SNACK",
      isFavorite:
        false,
    });
  }

  const filteredMeals =
    useMemo(() => {
      return meals.filter(
        (meal) => {
          const matchesSearch =
            meal.name
              .toLowerCase()
              .includes(
                search.toLowerCase()
              );

          const matchesType =
            filter ===
              "ALL" ||
            meal.mealType ===
              filter;

          return (
            matchesSearch &&
            matchesType
          );
        }
      );
    }, [
      meals,
      search,
      filter,
    ]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          Meals
        </h1>

        <p className="text-zinc-400">
          Manage meals
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {presets.map(
          (preset) => (
            <button
              key={
                preset.name
              }
              onClick={() =>
                setForm(
                  (
                    prev
                  ) => ({
                    ...prev,
                    name:
                      preset.name,
                    mealType:
                      preset.mealType as MealType,
                  })
                )
              }
              className="rounded-full bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
            >
              ⚡{" "}
              {
                preset.name
              }
            </button>
          )
        )}
      </div>

      <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            placeholder="Meal name"
            value={
              form.name
            }
            onChange={(e) =>
              setForm(
                (
                  prev
                ) => ({
                  ...prev,
                  name:
                    e.target
                      .value,
                })
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <select
            value={
              form.mealType
            }
            onChange={(e) =>
              setForm(
                (
                  prev
                ) => ({
                  ...prev,
                  mealType:
                    e.target
                      .value as MealType,
                })
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          >
            <option value="BREAKFAST">
              Breakfast
            </option>
            <option value="LUNCH">
              Lunch
            </option>
            <option value="DINNER">
              Dinner
            </option>
            <option value="SNACK">
              Snack
            </option>
            <option value="SHAKE">
              Shake
            </option>
          </select>

          <input
            type="number"
            step="0.1"
            placeholder="Calories"
            value={
              form.calories
            }
            onChange={(e) =>
              setForm(
                (
                  prev
                ) => ({
                  ...prev,
                  calories:
                    e.target
                      .value,
                })
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            step="0.1"
            placeholder="Protein"
            value={
              form.protein
            }
            onChange={(e) =>
              setForm(
                (
                  prev
                ) => ({
                  ...prev,
                  protein:
                    e.target
                      .value,
                })
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            step="0.1"
            placeholder="Carbs"
            value={
              form.carbs
            }
            onChange={(e) =>
              setForm(
                (
                  prev
                ) => ({
                  ...prev,
                  carbs:
                    e.target
                      .value,
                })
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />

          <input
            type="number"
            step="0.1"
            placeholder="Fat"
            value={
              form.fat
            }
            onChange={(e) =>
              setForm(
                (
                  prev
                ) => ({
                  ...prev,
                  fat:
                    e.target
                      .value,
                })
              )
            }
            className="rounded-2xl bg-zinc-900 p-3"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={
              saveMeal
            }
            className="flex-1 rounded-2xl bg-green-600 py-3 font-semibold hover:bg-green-700"
          >
            {editingId
              ? "Update Meal"
              : "Save Meal"}
          </button>

          {editingId && (
            <button
              onClick={
                resetForm
              }
              className="rounded-2xl bg-zinc-800 px-5 hover:bg-zinc-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <input
          placeholder="Search meal..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target
                .value
            )
          }
          className="flex-1 rounded-2xl bg-zinc-900 p-3"
        />

        <select
          value={filter}
          onChange={(e) =>
            setFilter(
              e.target
                .value as MealType | "ALL"
            )
          }
          className="rounded-2xl bg-zinc-900 px-4"
        >
          <option value="ALL">
            All
          </option>
          <option value="BREAKFAST">
            Breakfast
          </option>
          <option value="LUNCH">
            Lunch
          </option>
          <option value="DINNER">
            Dinner
          </option>
          <option value="SNACK">
            Snack
          </option>
          <option value="SHAKE">
            Shake
          </option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredMeals.map(
          (meal) => (
            <div
              key={
                meal.id
              }
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {
                      meal.name
                    }
                  </h2>

                  <p className="text-sm text-zinc-400">
                    {
                      meal.mealType
                    }
                  </p>
                </div>

                <button
                  onClick={() =>
                    toggleFavorite(
                      meal
                    )
                  }
                >
                  {meal.isFavorite
                    ? "⭐"
                    : "☆"}
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm">
                  {
                    meal.calories
                  }{" "}
                  kcal
                </span>

                <span className="rounded-full bg-blue-950 px-3 py-1 text-sm text-blue-300">
                  P:
                  {
                    meal.protein
                  }
                  g
                </span>

                <span className="rounded-full bg-yellow-950 px-3 py-1 text-sm text-yellow-300">
                  C:
                  {
                    meal.carbs
                  }
                  g
                </span>

                <span className="rounded-full bg-red-950 px-3 py-1 text-sm text-red-300">
                  F:
                  {
                    meal.fat
                  }
                  g
                </span>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={() =>
                    setQuantities(
                      (
                        prev
                      ) => ({
                        ...prev,
                        [meal.id]:
                          Math.max(
                            1,
                            (
                              prev[
                                meal.id
                              ] || 1
                            ) - 1
                          ),
                      })
                    )
                  }
                  className="rounded-lg bg-zinc-800 px-3 py-1"
                >
                  -
                </button>

                <span>
                  {quantities[
                    meal.id
                  ] || 1}
                </span>

                <button
                  onClick={() =>
                    setQuantities(
                      (
                        prev
                      ) => ({
                        ...prev,
                        [meal.id]:
                          (
                            prev[
                              meal.id
                            ] || 1
                          ) + 1,
                      })
                    )
                  }
                  className="rounded-lg bg-zinc-800 px-3 py-1"
                >
                  +
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    addMealToday(
                      meal.id
                    )
                  }
                  className="flex-1 rounded-xl bg-green-600 py-2"
                >
                  Add
                </button>

                <button
                  onClick={() =>
                    editMeal(
                      meal
                    )
                  }
                  className="rounded-xl bg-zinc-800 px-3"
                >
                  ✏
                </button>

                <button
                  onClick={() =>
                    deleteMeal(
                      meal.id
                    )
                  }
                  className="rounded-xl bg-red-600 px-3"
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