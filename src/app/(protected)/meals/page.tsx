"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { posthog } from "@/lib/posthog";

const FoodDatabaseModal = dynamic(() => import("@/components/FoodDatabaseModal"), { ssr: false });
const AIMealAnalyzer = dynamic(() => import("./AIMealAnalyzer"), { ssr: false });

// Inlined at build time via next.config env bridge — true only when OPENAI_API_KEY is set.
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";

interface UserMealCategory {
  id: string;
  name: string;
  emoji: string;
  orderIndex: number;
}

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
  categoryId: string | null;
  category: UserMealCategory | null;
  isFavorite: boolean;
}

interface MealPackItem {
  id: string;
  mealId: string;
  quantity: number;
  meal: Meal;
}

interface MealPack {
  id: string;
  name: string;
  items: MealPackItem[];
}

type ServingType = "piece" | "g" | "ml";

function MealsContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [meals, setMeals] = useState<Meal[]>([]);
  const [packs, setPacks] = useState<MealPack[]>([]);
  const [categories, setCategories] = useState<UserMealCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"meals" | "packs" | "categories">("meals");
  const [newPackName, setNewPackName] = useState("");
  const [expandedPack, setExpandedPack] = useState<string | null>(null);
  const [loggedPack, setLoggedPack] = useState<Record<string, boolean>>({});
  const [showFoodDB, setShowFoodDB] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // Category manager state
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🍽️");
  const [editingCat, setEditingCat] = useState<UserMealCategory | null>(null);

  const [form, setForm] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sodium: "",
    servingSize: "100",
    servingType: "g" as ServingType,
    categoryId: "",
    isFavorite: false,
  });

  async function fetchAll() {
    const res = await fetch("/api/meals/all");
    const data = await res.json();
    setMeals(data.meals);
    setPacks(data.packs);
    setCategories(data.categories);
  }

  useEffect(() => { fetchAll(); }, []);

  async function saveMeal() {
    if (!form.name || form.calories === "") { alert("Fill name and calories"); return; }
    const servingLabel = form.servingType;
    const servingSize = form.servingType === "piece" ? 1 : Number(form.servingSize) || 100;
    const payload = {
      name: form.name,
      calories: Number(form.calories),
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      fiber: Number(form.fiber) || null,
      sodium: Number(form.sodium) || null,
      servingSize,
      servingLabel,
      categoryId: form.categoryId || null,
      isFavorite: form.isFavorite,
    };
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/meals/${editingId}` : "/api/meals";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    resetForm();
    fetchAll();
  }

  async function deleteMeal(id: string) {
    await fetch(`/api/meals/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function toggleFavorite(meal: Meal) {
    await fetch(`/api/meals/${meal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meal, categoryId: meal.categoryId, isFavorite: !meal.isFavorite }),
    });
    fetchAll();
  }

  async function addMeal(meal: Meal) {
    const rawAmount = amounts[meal.id];
    const amount = rawAmount ? Number(rawAmount) : meal.servingLabel === "piece" ? 1 : meal.servingSize;
    if (!amount || amount <= 0) { alert("Enter a valid amount"); return; }
    const multiplier = meal.servingLabel === "piece" ? amount : amount / meal.servingSize;
    await fetch("/api/log-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId: meal.id, quantity: multiplier, date: dateParam }),
    });
    posthog.capture("meal_logged", { mealName: meal.name, calories: meal.calories });
    setAdded((p) => ({ ...p, [meal.id]: true }));
    setTimeout(() => setAdded((p) => ({ ...p, [meal.id]: false })), 1500);
  }

  async function createPack() {
    if (!newPackName.trim()) return;
    await fetch("/api/meal-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPackName }),
    });
    setNewPackName("");
    fetchAll();
  }

  async function deletePack(id: string) {
    await fetch(`/api/meal-packs/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function addMealToPack(packId: string, mealId: string) {
    await fetch(`/api/meal-packs/${packId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId, quantity: 1 }),
    });
    fetchAll();
  }

  async function removeMealFromPack(packId: string, itemId: string) {
    await fetch(`/api/meal-packs/${packId}/items?itemId=${itemId}`, { method: "DELETE" });
    fetchAll();
  }

  async function updatePackItemQuantity(packId: string, itemId: string, quantity: number) {
    if (quantity <= 0) return;
    await fetch(`/api/meal-packs/${packId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, quantity }),
    });
    fetchAll();
  }

  async function logPack(packId: string) {
    await fetch(`/api/meal-packs/${packId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateParam }),
    });
    setLoggedPack((p) => ({ ...p, [packId]: true }));
    setTimeout(() => setLoggedPack((p) => ({ ...p, [packId]: false })), 2000);
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    await fetch("/api/meal-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName, emoji: newCatEmoji }),
    });
    setNewCatName("");
    setNewCatEmoji("🍽️");
    fetchAll();
  }

  async function updateCategory() {
    if (!editingCat) return;
    await fetch(`/api/meal-categories/${editingCat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingCat.name, emoji: editingCat.emoji }),
    });
    setEditingCat(null);
    fetchAll();
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/meal-categories/${id}`, { method: "DELETE" });
    fetchAll();
  }

  function editMeal(meal: Meal) {
    setEditingId(meal.id);
    const servingType: ServingType =
      meal.servingLabel === "g" ? "g" : meal.servingLabel === "ml" ? "ml" : "piece";
    setForm({
      name: meal.name,
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
      fiber: String(meal.fiber ?? ""),
      sodium: String(meal.sodium ?? ""),
      servingSize: String(meal.servingSize),
      servingType,
      categoryId: meal.categoryId ?? "",
      isFavorite: meal.isFavorite,
    });
    setActiveTab("meals");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "", calories: "", protein: "", carbs: "", fat: "",
      fiber: "", sodium: "", servingSize: "100", servingType: "g",
      categoryId: "", isFavorite: false,
    });
  }

  function getPreview(meal: Meal) {
    const rawAmount = amounts[meal.id];
    if (!rawAmount) return null;
    const amount = Number(rawAmount);
    if (!amount || amount <= 0) return null;
    const multiplier = meal.servingLabel === "piece" ? amount : amount / meal.servingSize;
    return {
      calories: Math.round(meal.calories * multiplier),
      protein: Math.round(meal.protein * multiplier),
      carbs: Math.round(meal.carbs * multiplier),
      fat: Math.round(meal.fat * multiplier),
    };
  }

  function packTotals(pack: MealPack) {
    return pack.items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.meal.calories * item.quantity,
        protein: acc.protein + item.meal.protein * item.quantity,
        carbs: acc.carbs + item.meal.carbs * item.quantity,
        fat: acc.fat + item.meal.fat * item.quantity,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  const filteredMeals = useMemo(() => {
    return meals.filter((meal) => {
      const matchesSearch = meal.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "ALL" || meal.categoryId === filter;
      return matchesSearch && matchesFilter;
    });
  }, [meals, search, filter]);

  const displayDate = dateParam
    ? new Date(dateParam + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
      })
    : null;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Meals</h1>
        {displayDate ? (
          <p className="text-sm text-amber-400">Adding meals to: {displayDate}</p>
        ) : (
          <p className="text-sm text-zinc-400">Your personal meal library</p>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex rounded-xl bg-zinc-900 p-1">
        {(["meals", "packs", "categories"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${activeTab === tab ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>
            {tab === "meals" ? "Meals" : tab === "packs" ? "Packs 📦" : "Categories 🏷️"}
          </button>
        ))}
      </div>

      {/* MEALS TAB */}
      {activeTab === "meals" && (
        <>
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-3 font-semibold">{editingId ? "Edit Meal" : "New Meal"}</h2>
            <div className="space-y-3">
              <input placeholder="Meal name" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                  className="rounded-xl bg-zinc-800 p-3">
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                  ))}
                </select>
                <select value={form.servingType}
                  onChange={(e) => setForm((p) => ({ ...p, servingType: e.target.value as ServingType }))}
                  className="rounded-xl bg-zinc-800 p-3">
                  <option value="piece">Per piece</option>
                  <option value="g">Per grams (g)</option>
                  <option value="ml">Per ml</option>
                </select>
              </div>

              {form.servingType !== "piece" && (
                <div className="flex items-center gap-2 rounded-xl bg-zinc-800 p-3">
                  <span className="text-sm text-zinc-400">Base:</span>
                  <input type="number" value={form.servingSize}
                    onChange={(e) => setForm((p) => ({ ...p, servingSize: e.target.value }))}
                    className="w-20 bg-transparent outline-none" />
                  <span className="text-sm text-zinc-400">{form.servingType}</span>
                  <span className="ml-auto text-xs text-zinc-500">macros are for this amount</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Calories (kcal)" value={form.calories}
                  onChange={(e) => setForm((p) => ({ ...p, calories: e.target.value }))}
                  className="rounded-xl bg-zinc-800 p-3 outline-none" />
                <input type="number" placeholder="Protein (g)" value={form.protein}
                  onChange={(e) => setForm((p) => ({ ...p, protein: e.target.value }))}
                  className="rounded-xl bg-zinc-800 p-3 outline-none" />
                <input type="number" placeholder="Carbs (g)" value={form.carbs}
                  onChange={(e) => setForm((p) => ({ ...p, carbs: e.target.value }))}
                  className="rounded-xl bg-zinc-800 p-3 outline-none" />
                <input type="number" placeholder="Fat (g)" value={form.fat}
                  onChange={(e) => setForm((p) => ({ ...p, fat: e.target.value }))}
                  className="rounded-xl bg-zinc-800 p-3 outline-none" />
              </div>

              <div className="flex gap-3">
                <button onClick={saveMeal}
                  className="flex-1 rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-700">
                  {editingId ? "Update" : "Save Meal"}
                </button>
                {editingId && (
                  <button onClick={resetForm} className="rounded-xl bg-zinc-800 px-5 hover:bg-zinc-700">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                placeholder="Search meals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-xl bg-zinc-900 p-3 outline-none"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl bg-zinc-900 px-3 text-sm"
              >
                <option value="ALL">All</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                ))}
              </select>
            </div>
            <div className={AI_ENABLED ? "grid grid-cols-2 gap-2" : ""}>
              <button
                onClick={() => setShowFoodDB(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-800 bg-blue-950/40 py-2.5 text-sm font-bold text-blue-400 hover:bg-blue-900/40 transition-colors"
              >
                🔍 Food Database
              </button>
              {AI_ENABLED && (
                <button
                  onClick={() => setShowAI(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-800 bg-green-950/40 py-2.5 text-sm font-bold text-green-400 hover:bg-green-900/40 transition-colors"
                >
                  🍽️ AI Analiz
                </button>
              )}
            </div>
          </div>

          {showFoodDB && (
            <FoodDatabaseModal
              dateParam={dateParam}
              onClose={() => setShowFoodDB(false)}
              onAdded={fetchAll}
            />
          )}

          {showAI && (
            <AIMealAnalyzer
              dateParam={dateParam}
              onClose={() => setShowAI(false)}
              onAdded={fetchAll}
            />
          )}

          <div className="space-y-3">
            {filteredMeals.map((meal) => {
              const preview = getPreview(meal);
              const isPiece = meal.servingLabel === "piece";
              return (
                <div key={meal.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{meal.name}</h2>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                          {isPiece ? "per piece" : `per ${meal.servingSize}${meal.servingLabel}`}
                        </span>
                      </div>
                      {meal.category && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {meal.category.emoji} {meal.category.name}
                        </p>
                      )}
                    </div>
                    <button onClick={() => toggleFavorite(meal)} className="text-lg">
                      {meal.isFavorite ? "⭐" : "☆"}
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs">{meal.calories} kcal</span>
                    <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">P:{meal.protein}g</span>
                    <span className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-300">C:{meal.carbs}g</span>
                    <span className="rounded-full bg-rose-950 px-3 py-1 text-xs text-rose-300">F:{meal.fat}g</span>
                  </div>

                  <div className="mb-3">
                    {isPiece ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setAmounts((p) => ({ ...p, [meal.id]: String(Math.max(1, Number(p[meal.id] || 1) - 1)) }))}
                          className="rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700">−</button>
                        <span className="w-8 text-center font-semibold">{amounts[meal.id] || "1"}</span>
                        <button onClick={() => setAmounts((p) => ({ ...p, [meal.id]: String(Number(p[meal.id] || 1) + 1) }))}
                          className="rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700">+</button>
                        <span className="text-sm text-zinc-400">pieces</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input type="number" placeholder={`e.g. ${meal.servingSize}`}
                          value={amounts[meal.id] || ""}
                          onChange={(e) => setAmounts((p) => ({ ...p, [meal.id]: e.target.value }))}
                          className="w-28 rounded-xl bg-zinc-800 p-2 text-center outline-none focus:ring-1 focus:ring-zinc-600" />
                        <span className="text-sm text-zinc-400">{meal.servingLabel}</span>
                      </div>
                    )}
                  </div>

                  {preview && (
                    <div className="mb-3 rounded-xl bg-zinc-800 px-3 py-2">
                      <p className="text-xs text-zinc-400">
                        → {preview.calories} kcal · P:{preview.protein}g · C:{preview.carbs}g · F:{preview.fat}g
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => addMeal(meal)}
                      className={`flex-1 rounded-xl py-2 font-medium transition ${added[meal.id] ? "bg-green-800 text-green-300" : "bg-green-600 hover:bg-green-700"}`}>
                      {added[meal.id] ? "Added ✓" : dateParam ? "Add to Day" : "Add to Today"}
                    </button>
                    <button onClick={() => editMeal(meal)} className="rounded-xl bg-zinc-800 px-3 hover:bg-zinc-700">✏</button>
                    <button onClick={() => deleteMeal(meal.id)} className="rounded-xl bg-zinc-800 px-3 hover:bg-red-900">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* PACKS TAB */}
      {activeTab === "packs" && (
        <>
          <div className="mb-6 flex gap-3">
            <input placeholder="Pack name (e.g. Morning Pack)" value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPack()}
              className="flex-1 rounded-xl bg-zinc-900 p-3 outline-none focus:ring-1 focus:ring-zinc-600" />
            <button onClick={createPack} className="rounded-xl bg-green-600 px-4 font-semibold hover:bg-green-700">
              + Create
            </button>
          </div>

          <div className="space-y-4">
            {packs.length === 0 && (
              <p className="text-center text-sm text-zinc-500">No packs yet. Create one above.</p>
            )}
            {packs.map((pack) => {
              const totals = packTotals(pack);
              const isExpanded = expandedPack === pack.id;
              return (
                <div key={pack.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">📦 {pack.name}</h2>
                      <p className="text-xs text-zinc-500">{pack.items.length} meals</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setExpandedPack(isExpanded ? null : pack.id)}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-xs hover:bg-zinc-700">
                        {isExpanded ? "Close" : "Manage"}
                      </button>
                      <button onClick={() => logPack(pack.id)}
                        className={`rounded-xl px-3 py-2 text-xs font-medium transition ${loggedPack[pack.id] ? "bg-green-800 text-green-300" : "bg-green-600 hover:bg-green-700"}`}>
                        {loggedPack[pack.id] ? "Logged ✓" : "Log All"}
                      </button>
                      <button onClick={() => deletePack(pack.id)}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-xs hover:bg-red-900">🗑</button>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs">{Math.round(totals.calories)} kcal</span>
                    <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">P:{Math.round(totals.protein)}g</span>
                    <span className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-300">C:{Math.round(totals.carbs)}g</span>
                    <span className="rounded-full bg-rose-950 px-3 py-1 text-xs text-rose-300">F:{Math.round(totals.fat)}g</span>
                  </div>

                  {pack.items.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {pack.items.map((item) => (
                        <div key={item.id} className="rounded-xl bg-zinc-800 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.meal.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-400">{Math.round(item.meal.calories * item.quantity)} kcal</span>
                              {isExpanded && (
                                <button onClick={() => removeMealFromPack(pack.id, item.id)}
                                  className="text-xs text-zinc-500 hover:text-red-400">✕</button>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button onClick={() => updatePackItemQuantity(pack.id, item.id,
                              Math.max(item.meal.servingLabel === "piece" ? 1 : 0.5,
                                item.quantity - (item.meal.servingLabel === "piece" ? 1 : 0.5)))}
                              className="rounded-lg bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600">−</button>
                            <span className="min-w-16 text-center text-sm">
                              {item.meal.servingLabel === "piece"
                                ? `${item.quantity} pc`
                                : `${Math.round(item.quantity * item.meal.servingSize)}${item.meal.servingLabel}`}
                            </span>
                            <button onClick={() => updatePackItemQuantity(pack.id, item.id,
                              item.quantity + (item.meal.servingLabel === "piece" ? 1 : 0.5))}
                              className="rounded-lg bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600">+</button>
                            <span className="text-xs text-zinc-500">P:{Math.round(item.meal.protein * item.quantity)}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <div>
                      <p className="mb-2 text-xs text-zinc-500">Add meal to pack:</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {meals.filter((m) => !pack.items.some((i) => i.mealId === m.id)).map((meal) => (
                          <button key={meal.id} onClick={() => addMealToPack(pack.id, meal.id)}
                            className="flex w-full items-center justify-between rounded-xl bg-zinc-800 px-3 py-2 hover:bg-zinc-700">
                            <span className="text-sm">{meal.name}</span>
                            <span className="text-xs text-zinc-400">
                              {meal.calories} kcal · {meal.servingLabel === "piece" ? "per piece" : `per ${meal.servingSize}${meal.servingLabel}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          {/* Add new category */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-3 font-semibold">Add Category</h2>
            <div className="flex gap-2">
              <input placeholder="🍽️" value={newCatEmoji}
                onChange={(e) => setNewCatEmoji(e.target.value)}
                className="w-16 rounded-xl bg-zinc-800 p-2 text-center outline-none" />
              <input placeholder="Category name" value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
                className="flex-1 rounded-xl bg-zinc-800 p-2 outline-none" />
              <button onClick={createCategory}
                className="rounded-xl bg-green-600 px-3 text-sm font-semibold hover:bg-green-700">
                + Add
              </button>
            </div>
          </div>

          {/* Category list */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                {editingCat?.id === cat.id ? (
                  <div className="flex gap-2">
                    <input value={editingCat.emoji}
                      onChange={(e) => setEditingCat({ ...editingCat, emoji: e.target.value })}
                      className="w-16 rounded-xl bg-zinc-800 p-2 text-center outline-none" />
                    <input value={editingCat.name}
                      onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                      className="flex-1 rounded-xl bg-zinc-800 p-2 outline-none" />
                    <button onClick={updateCategory}
                      className="rounded-xl bg-green-600 px-3 text-sm hover:bg-green-700">✓</button>
                    <button onClick={() => setEditingCat(null)}
                      className="rounded-xl bg-zinc-800 px-3 text-sm hover:bg-zinc-700">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-xs text-zinc-500">
                        {meals.filter(m => m.categoryId === cat.id).length} meals
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingCat(cat)}
                        className="rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">✏</button>
                      <button onClick={() => deleteCategory(cat.id)}
                        className="rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-red-900">🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default function MealsPage() {
  return (
    <Suspense fallback={<main className="p-4 text-zinc-400">Loading...</main>}>
      <MealsContent />
    </Suspense>
  );
}