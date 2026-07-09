"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { posthog } from "@/lib/posthog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MacroChip } from "@/components/ui/MacroChip";
import { EmptyState } from "@/components/ui/Primitives";
import { METRICS } from "@/lib/metrics";

const FoodDatabaseModal = dynamic(() => import("@/components/FoodDatabaseModal"), { ssr: false });
const AIMealAnalyzer = dynamic(() => import("./AIMealAnalyzer"), { ssr: false });

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  imageUrl?: string | null;
  orderIndex: number;
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

// Today's logged entries (from the daily log)
interface LoggedMeal {
  id: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt?: string;
  meal: { id: string; name: string; servingLabel: string; servingSize: number; imageUrl?: string | null } | null;
  mealSnapshot: { name: string; servingLabel: string; servingSize: number; imageUrl?: string | null } | null;
}

type ServingType = "piece" | "g" | "ml";
type MealFilter = "ALL" | "FAVORITES" | "HIGH_PROTEIN" | "LOW_CARB" | "RECENT";
type MealView = "today" | "library";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_COLORS = [
  "bg-red-600", "bg-orange-600", "bg-yellow-600", "bg-green-600",
  "bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-pink-600",
];

function placeholderColor(name: string) {
  return PLACEHOLDER_COLORS[(name.charCodeAt(0) ?? 0) % PLACEHOLDER_COLORS.length];
}

function MealAvatar({ meal }: { meal: { name: string; imageUrl?: string | null } }) {
  if (meal.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={meal.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
    );
  }
  return (
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0 ${placeholderColor(meal.name)}`}>
      {meal.name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function getPreview(meal: Meal, amount: string | undefined) {
  if (!amount) return null;
  const n = Number(amount);
  if (!n || n <= 0) return null;
  const multiplier = meal.servingLabel === "piece" ? n : n / meal.servingSize;
  return {
    calories: Math.round(meal.calories * multiplier),
    protein: Math.round(meal.protein * multiplier),
    carbs: Math.round(meal.carbs * multiplier),
    fat: Math.round(meal.fat * multiplier),
  };
}

// Is this meal protein-dense? (≥30% of its calories from protein)
function isHighProtein(m: Meal) {
  if (m.calories <= 0) return m.protein >= 20;
  return (m.protein * 4) / m.calories >= 0.3;
}
// Low carb? (≤20% of calories from carbs, or simply very few carbs)
function isLowCarb(m: Meal) {
  if (m.calories <= 0) return m.carbs <= 10;
  return (m.carbs * 4) / m.calories <= 0.2;
}

// ── Meal-time grouping for Today's Log ──
type MealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snack";
const SLOT_ORDER: MealSlot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const SLOT_ICON: Record<MealSlot, string> = {
  "Breakfast": "🌅",
  "Lunch": "☀️",
  "Dinner": "🌙",
  "Snack": "🍎",
};
function slotFor(log: LoggedMeal): MealSlot {
  if (!log.createdAt) return "Snack";
  const hour = new Date(log.createdAt).getHours();
  if (hour >= 4 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 16) return "Lunch";
  if (hour >= 16 && hour < 22) return "Dinner";
  return "Snack";
}
function loggedInfo(log: LoggedMeal) {
  const info = log.meal ?? log.mealSnapshot;
  return {
    name: info?.name ?? "Unknown",
    servingLabel: info?.servingLabel ?? "g",
    servingSize: info?.servingSize ?? 100,
    imageUrl: info?.imageUrl ?? null,
  };
}
function loggedQty(log: LoggedMeal) {
  const info = loggedInfo(log);
  if (info.servingLabel === "piece") return `x${log.quantity}`;
  return `${Math.round(log.quantity * info.servingSize)}${info.servingLabel}`;
}

// ─── Compact Meal Card ─────────────────────────────────────────────────────────

interface DragHandleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: Record<string, any>;
}

function MealCard({
  meal,
  expanded,
  onToggleExpand,
  onAddMeal,
  amount,
  onAmountChange,
  added,
  onEdit,
  onDelete,
  onToggleFavorite,
  dateParam,
  dragHandle,
}: {
  meal: Meal;
  expanded: boolean;
  onToggleExpand: () => void;
  onAddMeal: () => void;
  amount: string;
  onAmountChange: (v: string) => void;
  added: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  dateParam: string | null;
  dragHandle?: DragHandleProps;
}) {
  const isPiece = meal.servingLabel === "piece";
  const preview = getPreview(meal, amount || undefined);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-700">
      {/* Main row — clicking anywhere on it toggles the panel */}
      <div
        onClick={onToggleExpand}
        role="button"
        aria-expanded={expanded}
        className="flex cursor-pointer items-center gap-2 px-2 py-2"
      >
        {/* Drag handle */}
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab active:cursor-grabbing select-none text-[13px] leading-none text-zinc-600 hover:text-zinc-400"
          style={{ touchAction: "none" }}
          tabIndex={-1}
          aria-label="Reorder"
          {...dragHandle?.listeners}
          {...dragHandle?.attributes}
        >
          ⠿
        </button>

        {/* Avatar */}
        <MealAvatar meal={meal} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {meal.category && <span className="text-sm" title={meal.category.name}>{meal.category.emoji}</span>}
            <p className="truncate text-sm font-semibold text-white leading-tight">{meal.name}</p>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
              {meal.calories}
            </span>
            <span className="text-[10px] text-zinc-500">kcal</span>
            <MacroChip metric="protein" value={meal.protein} />
            <MacroChip metric="carbs" value={meal.carbs} />
            <MacroChip metric="fat" value={meal.fat} />
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            aria-label={meal.isFavorite ? "Remove from favorites" : "Add to favorites"}
            className={`px-1.5 py-1 text-lg transition-colors ${meal.isFavorite ? "text-yellow-400" : "text-zinc-600 hover:text-zinc-400"}`}
          >
            {meal.isFavorite ? "★" : "☆"}
          </button>
          <span aria-hidden className="px-1 py-1 text-[10px] text-zinc-500">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-zinc-800 px-3 pb-3 pt-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isPiece ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAmountChange(String(Math.max(1, Number(amount || 1) - 1)))}
                  aria-label="Decrease"
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold hover:bg-zinc-700"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold">{amount || "1"}</span>
                <button
                  onClick={() => onAmountChange(String(Number(amount || 1) + 1))}
                  aria-label="Increase"
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold hover:bg-zinc-700"
                >
                  +
                </button>
                <span className="text-xs text-zinc-500">pc</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`${meal.servingSize}`}
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  aria-label="Amount"
                  className="w-24 rounded-xl bg-zinc-800 px-3 py-1.5 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                />
                <span className="text-xs text-zinc-500">{meal.servingLabel}</span>
              </div>
            )}
            {preview && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500">
                → <span className="font-semibold" style={{ color: METRICS.calories.hex }}>{preview.calories}</span> kcal
                <MacroChip metric="protein" value={preview.protein} />
                <MacroChip metric="carbs" value={preview.carbs} />
                <MacroChip metric="fat" value={preview.fat} />
              </span>
            )}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={onAddMeal}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                added ? "bg-green-800 text-green-300" : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              {added ? "Added ✓" : dateParam ? "Add to Day" : "Add to Today"}
            </button>
            <button
              onClick={onEdit}
              aria-label="Edit"
              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs hover:bg-zinc-700 transition-colors"
            >
              ✏
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete"
              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs hover:bg-red-900/60 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortable wrapper ─────────────────────────────────────────────────────────

function SortableMealCard(props: Omit<React.ComponentProps<typeof MealCard>, "dragHandle">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.meal.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      <MealCard {...props} dragHandle={{ listeners, attributes }} />
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function MealsContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [meals, setMeals] = useState<Meal[]>([]);
  const [packs, setPacks] = useState<MealPack[]>([]);
  const [categories, setCategories] = useState<UserMealCategory[]>([]);
  const [recentMealIds, setRecentMealIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MealFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"meals" | "packs" | "categories">("meals");
  const [mealView, setMealView] = useState<MealView>(dateParam ? "library" : "today");
  const [newPackName, setNewPackName] = useState("");
  const [expandedPack, setExpandedPack] = useState<string | null>(null);
  const [loggedPack, setLoggedPack] = useState<Record<string, boolean>>({});
  const [showFoodDB, setShowFoodDB] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Today's log
  const [todayLogs, setTodayLogs] = useState<LoggedMeal[]>([]);
  const [todayGoals, setTodayGoals] = useState<{ calories: number; protein: number } | null>(null);

  // Category manager
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
    imageUrl: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Data ───────────────────────────────────────────────────────────────────

  async function fetchAll() {
    const res = await fetch("/api/meals/all");
    const data = await res.json();
    setMeals(data.meals ?? []);
    setPacks(data.packs ?? []);
    setCategories(data.categories ?? []);
    setRecentMealIds(data.recentMealIds ?? []);
  }

  async function fetchTodayLog() {
    const res = await fetch(`/api/dashboard?date=${dateParam ?? ""}`);
    const data = await res.json();
    setTodayLogs(data.mealLogs ?? []);
    setTodayGoals({ calories: data.goals?.calories ?? 0, protein: data.goals?.protein ?? 0 });
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAll();
      void fetchTodayLog();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtered / sorted meal lists ───────────────────────────────────────────

  const filteredMeals = useMemo(() => {
    return meals.filter((meal) => {
      const matchSearch = meal.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !categoryFilter || meal.categoryId === categoryFilter;
      const matchFilter =
        filter === "ALL" ||
        (filter === "FAVORITES" && meal.isFavorite) ||
        (filter === "HIGH_PROTEIN" && isHighProtein(meal)) ||
        (filter === "LOW_CARB" && isLowCarb(meal)) ||
        (filter === "RECENT" && recentMealIds.includes(meal.id));
      return matchSearch && matchCategory && matchFilter;
    });
  }, [meals, search, filter, categoryFilter, recentMealIds]);

  // "Recent" is ordered by recency; everything else keeps manual order.
  const orderedFiltered = useMemo(() => {
    if (filter !== "RECENT") return filteredMeals;
    return [...filteredMeals].sort(
      (a, b) => recentMealIds.indexOf(a.id) - recentMealIds.indexOf(b.id)
    );
  }, [filteredMeals, filter, recentMealIds]);

  // Drag & drop only when the list reflects the manual order (no recency sort).
  const dndEnabled = filter !== "RECENT";
  const favMeals = useMemo(() => orderedFiltered.filter((m) => m.isFavorite), [orderedFiltered]);
  const restMeals = useMemo(() => orderedFiltered.filter((m) => !m.isFavorite), [orderedFiltered]);

  const recentMeals = useMemo(
    () =>
      recentMealIds
        .map((id) => meals.find((m) => m.id === id))
        .filter((m): m is Meal => !!m)
        .slice(0, 6),
    [recentMealIds, meals]
  );

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  function makeDragEnd(group: "fav" | "rest") {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const list = group === "fav" ? favMeals : restMeals;
      const oldIdx = list.findIndex((m) => m.id === String(active.id));
      const newIdx = list.findIndex((m) => m.id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(list, oldIdx, newIdx);
      const other = group === "fav" ? restMeals : favMeals;
      const allOrdered = group === "fav" ? [...reordered, ...other] : [...favMeals, ...reordered];

      setMeals((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        allOrdered.forEach((m, i) => {
          const existing = map.get(m.id);
          if (existing) map.set(m.id, { ...existing, orderIndex: i });
        });
        return Array.from(map.values());
      });

      fetch("/api/meals/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: allOrdered.map((m, i) => ({ id: m.id, orderIndex: i })) }),
      }).catch(() => {});
    };
  }

  // ── Meal CRUD ──────────────────────────────────────────────────────────────

  async function saveMeal() {
    if (!form.name || form.calories === "") { alert("Name and calories are required"); return; }
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
      imageUrl: form.imageUrl.trim() || null,
    };
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/meals/${editingId}` : "/api/meals";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    resetForm();
    setShowForm(false);
    fetchAll();
  }

  async function deleteMeal(id: string) {
    await fetch(`/api/meals/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function toggleFavorite(meal: Meal) {
    setMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, isFavorite: !m.isFavorite } : m)));
    await fetch(`/api/meals/${meal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meal, isFavorite: !meal.isFavorite }),
    });
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
    fetchTodayLog();
  }

  // Quick-add one serving straight from the recently-consumed row.
  async function quickAdd(meal: Meal) {
    await fetch("/api/log-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId: meal.id, quantity: 1, date: dateParam }),
    });
    posthog.capture("meal_logged", { mealName: meal.name, calories: meal.calories });
    setAdded((p) => ({ ...p, [meal.id]: true }));
    setTimeout(() => setAdded((p) => ({ ...p, [meal.id]: false })), 1500);
    fetchTodayLog();
  }

  async function removeLoggedMeal(id: string) {
    setTodayLogs((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/log-meal/${id}`, { method: "DELETE" });
    fetchTodayLog();
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
      imageUrl: meal.imageUrl ?? "",
    });
    setShowForm(true);
    setActiveTab("meals");
    setMealView("library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "", calories: "", protein: "", carbs: "", fat: "",
      fiber: "", sodium: "", servingSize: "100", servingType: "g",
      categoryId: "", isFavorite: false, imageUrl: "",
    });
  }

  // ── Pack helpers ───────────────────────────────────────────────────────────

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
    fetchTodayLog();
  }

  // ── Category helpers ───────────────────────────────────────────────────────

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

  const displayDate = dateParam
    ? new Date(dateParam + "T12:00:00").toLocaleDateString("tr-TR", {
        weekday: "long", day: "numeric", month: "long",
      })
    : null;

  // ── Today's log grouping ──
  const todayGroups = useMemo(() => {
    const groups = new Map<MealSlot, LoggedMeal[]>();
    for (const log of todayLogs) {
      const slot = slotFor(log);
      if (!groups.has(slot)) groups.set(slot, []);
      groups.get(slot)!.push(log);
    }
    return SLOT_ORDER.filter((s) => groups.has(s)).map((slot) => {
      const logs = groups.get(slot)!;
      return { slot, logs, calories: logs.reduce((s, l) => s + l.calories, 0) };
    });
  }, [todayLogs]);

  const todayTotals = useMemo(
    () =>
      todayLogs.reduce(
        (a, l) => ({
          calories: a.calories + l.calories,
          protein: a.protein + l.protein,
          carbs: a.carbs + l.carbs,
          fat: a.fat + l.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [todayLogs]
  );

  const FILTER_CHIPS: { key: MealFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "HIGH_PROTEIN", label: "High Protein" },
    { key: "LOW_CARB", label: "Low Carb" },
    { key: "FAVORITES", label: "★ Favoriler" },
    { key: "RECENT", label: "Recent" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-2xl p-4 pb-28">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-green-400/80">Beslenme</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Meals</h1>
          {displayDate ? (
            <p className="text-xs" style={{ color: METRICS.calories.hex }}>Adding for {displayDate}</p>
          ) : (
            <p className="text-xs text-zinc-500">Your personal meal library</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex rounded-xl bg-zinc-900 p-1">
        {(["meals", "packs", "categories"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              activeTab === tab ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "meals" ? "Meals" : tab === "packs" ? "Packs" : "Kategoriler"}
          </button>
        ))}
      </div>

      {/* ── MEALS TAB ── */}
      {activeTab === "meals" && (
        <>
          {/* Today's Log / Library toggle */}
          <div className="mb-4 flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
            {(["today", "library"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMealView(v)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                  mealView === v ? "bg-green-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {v === "today" ? "Today's Log" : "Library"}
              </button>
            ))}
          </div>

          {/* ── TODAY'S LOG VIEW ── */}
          {mealView === "today" && (
            <div className="space-y-4">
              {/* Day summary */}
              <div className="rounded-2xl border border-zinc-700/70 bg-zinc-900 p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Today&apos;s total</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
                      {Math.round(todayTotals.calories)}
                      {todayGoals && <span className="ml-1 text-sm font-medium text-zinc-500">/ {todayGoals.calories} kcal</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <MacroChip metric="protein" value={todayTotals.protein} size="md" />
                    <MacroChip metric="carbs" value={todayTotals.carbs} size="md" />
                    <MacroChip metric="fat" value={todayTotals.fat} size="md" />
                  </div>
                </div>
              </div>

              {todayLogs.length === 0 ? (
                <EmptyState
                  icon="🍽️"
                  title="Nothing logged today yet"
                  message="Start the day by adding a meal from your library."
                  ctaLabel="Go to library"
                  onCta={() => setMealView("library")}
                />
              ) : (
                todayGroups.map((group) => (
                  <div key={group.slot} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SLOT_ICON[group.slot]}</span>
                        <span className="text-sm font-semibold text-white">{group.slot}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: METRICS.calories.hex }}>
                        {Math.round(group.calories)} kcal
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.logs.map((log) => {
                        const info = loggedInfo(log);
                        return (
                          <div key={log.id} className="flex items-center gap-2.5 rounded-xl bg-zinc-800/60 p-2.5">
                            <MealAvatar meal={info} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{info.name}</p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-xs font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
                                  {Math.round(log.calories)}
                                </span>
                                <span className="text-[10px] text-zinc-500">kcal · {loggedQty(log)}</span>
                                <MacroChip metric="protein" value={log.protein} />
                                <MacroChip metric="carbs" value={log.carbs} />
                                <MacroChip metric="fat" value={log.fat} />
                              </div>
                            </div>
                            <button
                              onClick={() => removeLoggedMeal(log.id)}
                              aria-label={`Delete ${info.name} entry`}
                              className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900 hover:text-red-300"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setMealView("library")}
                      className="mt-3 w-full rounded-xl border border-dashed border-zinc-700 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    >
                      + Add meal
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── LIBRARY VIEW ── */}
          {mealView === "library" && (
            <>
              {/* Search + action bar */}
              <div className="mb-3 space-y-3">
                <input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search meals"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                />

                {/* Filter chips */}
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_CHIPS.map((chip) => (
                    <button
                      key={chip.key}
                      onClick={() => setFilter(chip.key)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        filter === chip.key
                          ? "bg-green-600 text-white"
                          : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(categoryFilter === cat.id ? "" : cat.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        categoryFilter === cat.id
                          ? "bg-zinc-700 text-white"
                          : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600"
                      }`}
                    >
                      {cat.emoji} {cat.name}
                    </button>
                  ))}
                </div>

                {/* Action buttons row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (showForm && editingId) resetForm();
                      setShowForm((v) => !v);
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      showForm
                        ? "border border-zinc-600 bg-zinc-800 text-zinc-300"
                        : "bg-green-600 text-white hover:bg-green-500"
                    }`}
                  >
                    {showForm ? "✕ Close" : "+ New Meal"}
                  </button>
                  <button
                    onClick={() => setShowFoodDB(true)}
                    className="flex-1 rounded-xl border border-blue-800 bg-blue-950/40 py-2 text-xs font-bold text-blue-400 hover:bg-blue-900/40 transition-colors"
                  >
                    Food Database
                  </button>
                  {AI_ENABLED && (
                    <button
                      onClick={() => setShowAI(true)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-green-800 bg-green-950/40 py-2 text-xs font-bold text-green-400 hover:bg-green-900/40 transition-colors"
                    >
                      ✨ AI Analiz
                    </button>
                  )}
                </div>
              </div>

              {/* ── New / Edit Meal Form (collapsible) ── */}
              {showForm && (
                <div className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {editingId ? "Edit Meal" : "New Meal"}
                  </p>
                  <div className="space-y-2">
                    <input
                      placeholder="Meal name"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-600"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
                      >
                        <option value="">No category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                        ))}
                      </select>
                      <select
                        value={form.servingType}
                        onChange={(e) => setForm((p) => ({ ...p, servingType: e.target.value as ServingType }))}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
                      >
                        <option value="piece">Per piece</option>
                        <option value="g">Gram (g)</option>
                        <option value="ml">Mililitre (ml)</option>
                      </select>
                    </div>

                    {form.servingType !== "piece" && (
                      <div className="flex items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2">
                        <span className="text-xs text-zinc-500">Baz:</span>
                        <input
                          type="number"
                          value={form.servingSize}
                          onChange={(e) => setForm((p) => ({ ...p, servingSize: e.target.value }))}
                          className="w-16 bg-transparent text-sm outline-none"
                        />
                        <span className="text-xs text-zinc-500">{form.servingType}</span>
                        <span className="ml-auto text-[10px] text-zinc-600">macros are for this amount</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" placeholder="Kalori (kcal)" value={form.calories}
                        onChange={(e) => setForm((p) => ({ ...p, calories: e.target.value }))}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600" />
                      <input type="number" placeholder="Protein (g)" value={form.protein}
                        onChange={(e) => setForm((p) => ({ ...p, protein: e.target.value }))}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600" />
                      <input type="number" placeholder="Karbonhidrat (g)" value={form.carbs}
                        onChange={(e) => setForm((p) => ({ ...p, carbs: e.target.value }))}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600" />
                      <input type="number" placeholder="Fat (g)" value={form.fat}
                        onChange={(e) => setForm((p) => ({ ...p, fat: e.target.value }))}
                        className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600" />
                    </div>

                    <input
                      placeholder="Resim URL (opsiyonel)"
                      value={form.imageUrl}
                      onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                      className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-600"
                    />

                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={form.isFavorite}
                          onChange={(e) => setForm((p) => ({ ...p, isFavorite: e.target.checked }))}
                          className="rounded"
                        />
                        Add to favorites
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={saveMeal}
                        className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-500 transition-colors"
                      >
                        {editingId ? "Update" : "Save"}
                      </button>
                      {editingId && (
                        <button
                          onClick={() => { resetForm(); setShowForm(false); }}
                          className="rounded-xl bg-zinc-800 px-4 text-sm hover:bg-zinc-700 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modals */}
              {showFoodDB && (
                <FoodDatabaseModal dateParam={dateParam} onClose={() => setShowFoodDB(false)} onAdded={() => { fetchAll(); fetchTodayLog(); }} />
              )}
              {showAI && (
                <AIMealAnalyzer dateParam={dateParam} onClose={() => setShowAI(false)} onAdded={() => { fetchAll(); fetchTodayLog(); }} />
              )}

              {/* Recently consumed quick-add */}
              {recentMeals.length > 0 && filter === "ALL" && !search && !categoryFilter && (
                <div className="mb-4">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recently used</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recentMeals.map((meal) => (
                      <button
                        key={meal.id}
                        onClick={() => quickAdd(meal)}
                        className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                          added[meal.id]
                            ? "border-green-700 bg-green-900/40"
                            : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                        }`}
                      >
                        <MealAvatar meal={meal} />
                        <div>
                          <p className="max-w-[7rem] truncate text-xs font-semibold text-white">{meal.name}</p>
                          <p className="text-[10px]" style={{ color: METRICS.calories.hex }}>
                            {added[meal.id] ? "Added ✓" : `${meal.calories} kcal`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Meal list ── */}
              <div className="space-y-1">
                {/* Favorites section */}
                {favMeals.length > 0 && (
                  <>
                    <p className="pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-600">
                      ★ Favoriler
                    </p>
                    {dndEnabled ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeDragEnd("fav")}>
                        <SortableContext items={favMeals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1">
                            {favMeals.map((meal) => (
                              <SortableMealCard
                                key={meal.id}
                                meal={meal}
                                expanded={expandedMeal === meal.id}
                                onToggleExpand={() => setExpandedMeal((v) => (v === meal.id ? null : meal.id))}
                                onAddMeal={() => addMeal(meal)}
                                amount={amounts[meal.id] ?? ""}
                                onAmountChange={(v) => setAmounts((p) => ({ ...p, [meal.id]: v }))}
                                added={!!added[meal.id]}
                                onEdit={() => editMeal(meal)}
                                onDelete={() => deleteMeal(meal.id)}
                                onToggleFavorite={() => toggleFavorite(meal)}
                                dateParam={dateParam}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="space-y-1">
                        {favMeals.map((meal) => (
                          <MealCard
                            key={meal.id}
                            meal={meal}
                            expanded={expandedMeal === meal.id}
                            onToggleExpand={() => setExpandedMeal((v) => (v === meal.id ? null : meal.id))}
                            onAddMeal={() => addMeal(meal)}
                            amount={amounts[meal.id] ?? ""}
                            onAmountChange={(v) => setAmounts((p) => ({ ...p, [meal.id]: v }))}
                            added={!!added[meal.id]}
                            onEdit={() => editMeal(meal)}
                            onDelete={() => deleteMeal(meal.id)}
                            onToggleFavorite={() => toggleFavorite(meal)}
                            dateParam={dateParam}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Other meals section */}
                {restMeals.length > 0 && (
                  <>
                    {favMeals.length > 0 && (
                      <p className="pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Other</p>
                    )}
                    {dndEnabled ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeDragEnd("rest")}>
                        <SortableContext items={restMeals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1">
                            {restMeals.map((meal) => (
                              <SortableMealCard
                                key={meal.id}
                                meal={meal}
                                expanded={expandedMeal === meal.id}
                                onToggleExpand={() => setExpandedMeal((v) => (v === meal.id ? null : meal.id))}
                                onAddMeal={() => addMeal(meal)}
                                amount={amounts[meal.id] ?? ""}
                                onAmountChange={(v) => setAmounts((p) => ({ ...p, [meal.id]: v }))}
                                added={!!added[meal.id]}
                                onEdit={() => editMeal(meal)}
                                onDelete={() => deleteMeal(meal.id)}
                                onToggleFavorite={() => toggleFavorite(meal)}
                                dateParam={dateParam}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="space-y-1">
                        {restMeals.map((meal) => (
                          <MealCard
                            key={meal.id}
                            meal={meal}
                            expanded={expandedMeal === meal.id}
                            onToggleExpand={() => setExpandedMeal((v) => (v === meal.id ? null : meal.id))}
                            onAddMeal={() => addMeal(meal)}
                            amount={amounts[meal.id] ?? ""}
                            onAmountChange={(v) => setAmounts((p) => ({ ...p, [meal.id]: v }))}
                            added={!!added[meal.id]}
                            onEdit={() => editMeal(meal)}
                            onDelete={() => deleteMeal(meal.id)}
                            onToggleFavorite={() => toggleFavorite(meal)}
                            dateParam={dateParam}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {orderedFiltered.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-3xl">🥗</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-400">
                      {search || filter !== "ALL" || categoryFilter ? "No results found" : "No meals yet"}
                    </p>
                    {!search && filter === "ALL" && !categoryFilter && (
                      <button
                        onClick={() => setShowForm(true)}
                        className="mt-3 rounded-xl bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-500"
                      >
                        + Add your first meal
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── PACKS TAB ── */}
      {activeTab === "packs" && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              placeholder="Pack name (e.g. Morning Pack)"
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPack()}
              className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
            />
            <button
              onClick={createPack}
              className="rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-500 transition-colors"
            >
              + Create
            </button>
          </div>

          <div className="space-y-3">
            {packs.length === 0 && (
              <p className="py-10 text-center text-sm text-zinc-500">No packs yet.</p>
            )}
            {packs.map((pack) => {
              const totals = packTotals(pack);
              const isExpanded = expandedPack === pack.id;
              return (
                <div
                  key={pack.id}
                  onClick={() => setExpandedPack(isExpanded ? null : pack.id)}
                  role="button"
                  aria-expanded={isExpanded}
                  className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span aria-hidden className={`text-xs text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▸</span>
                      <div>
                        <p className="text-sm font-bold">{pack.name}</p>
                        <p className="text-[10px] text-zinc-500">{pack.items.length} meals</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); logPack(pack.id); }}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          loggedPack[pack.id] ? "bg-green-800 text-green-300" : "bg-green-600 text-white hover:bg-green-500"
                        }`}
                      >
                        {loggedPack[pack.id] ? "Added ✓" : "Add All"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePack(pack.id); }}
                        aria-label="Delete pack"
                        className="rounded-xl bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-red-900/60 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className={`flex flex-wrap items-center gap-1.5 ${isExpanded ? "mb-2" : ""}`}>
                    <span className="text-sm font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
                      {Math.round(totals.calories)}
                    </span>
                    <span className="text-[10px] text-zinc-500">kcal</span>
                    <MacroChip metric="protein" value={totals.protein} />
                    <MacroChip metric="carbs" value={totals.carbs} />
                    <MacroChip metric="fat" value={totals.fat} />
                  </div>

                  {isExpanded && pack.items.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {pack.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-xl bg-zinc-800 px-2.5 py-2">
                          <MealAvatar meal={item.meal} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-semibold">{item.meal.name}</p>
                            <p className="text-[10px] text-zinc-500">{Math.round(item.meal.calories * item.quantity)} kcal</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); updatePackItemQuantity(pack.id, item.id,
                                Math.max(item.meal.servingLabel === "piece" ? 1 : 0.5,
                                  item.quantity - (item.meal.servingLabel === "piece" ? 1 : 0.5))); }}
                              aria-label="Decrease"
                              className="rounded-lg bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
                            >
                              −
                            </button>
                            <span className="min-w-[3rem] text-center text-xs">
                              {item.meal.servingLabel === "piece"
                                ? `${item.quantity} pc`
                                : `${Math.round(item.quantity * item.meal.servingSize)}${item.meal.servingLabel}`}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updatePackItemQuantity(pack.id, item.id,
                                item.quantity + (item.meal.servingLabel === "piece" ? 1 : 0.5)); }}
                              aria-label="Increase"
                              className="rounded-lg bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
                            >
                              +
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeMealFromPack(pack.id, item.id); }}
                              aria-label="Remove from pack"
                              className="ml-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Add Meal</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {meals.filter((m) => !pack.items.some((i) => i.mealId === m.id)).map((meal) => (
                          <button
                            key={meal.id}
                            onClick={(e) => { e.stopPropagation(); addMealToPack(pack.id, meal.id); }}
                            className="flex w-full items-center justify-between rounded-xl bg-zinc-800 px-3 py-2 text-left hover:bg-zinc-700 transition-colors"
                          >
                            <span className="text-xs font-medium">{meal.name}</span>
                            <span className="text-[10px] text-zinc-500">{meal.calories} kcal</span>
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

      {/* ── CATEGORIES TAB ── */}
      {activeTab === "categories" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Add Category</p>
            <div className="flex gap-2">
              <input
                placeholder="🍽️"
                value={newCatEmoji}
                onChange={(e) => setNewCatEmoji(e.target.value)}
                aria-label="Kategori emojisi"
                className="w-14 rounded-xl bg-zinc-800 p-2 text-center text-lg outline-none"
              />
              <input
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
                className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={createCategory}
                className="rounded-xl bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-500 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                {editingCat?.id === cat.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editingCat.emoji}
                      onChange={(e) => setEditingCat({ ...editingCat, emoji: e.target.value })}
                      className="w-14 rounded-xl bg-zinc-800 p-2 text-center outline-none"
                    />
                    <input
                      value={editingCat.name}
                      onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                      className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none"
                    />
                    <button onClick={updateCategory} className="rounded-xl bg-green-600 px-3 text-sm hover:bg-green-500">✓</button>
                    <button onClick={() => setEditingCat(null)} className="rounded-xl bg-zinc-800 px-3 text-sm hover:bg-zinc-700">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.emoji}</span>
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className="text-[10px] text-zinc-600">
                        {meals.filter((m) => m.categoryId === cat.id).length} yemek
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditingCat(cat)} aria-label="Edit" className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs hover:bg-zinc-700 transition-colors">✏</button>
                      <button onClick={() => deleteCategory(cat.id)} aria-label="Delete" className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs hover:bg-red-900/60 transition-colors">✕</button>
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
