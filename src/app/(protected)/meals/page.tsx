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

type ServingType = "piece" | "g" | "ml";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_COLORS = [
  "bg-red-600", "bg-orange-600", "bg-yellow-600", "bg-green-600",
  "bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-pink-600",
];

function placeholderColor(name: string) {
  return PLACEHOLDER_COLORS[(name.charCodeAt(0) ?? 0) % PLACEHOLDER_COLORS.length];
}

function MealAvatar({ meal }: { meal: Meal }) {
  if (meal.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={meal.imageUrl}
        alt=""
        className="h-10 w-10 rounded-lg object-cover shrink-0"
      />
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
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Main row */}
      <div className="flex items-center gap-2 px-2 py-2">
        {/* Drag handle */}
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing select-none text-[13px] leading-none text-zinc-600 hover:text-zinc-400"
          style={{ touchAction: "none" }}
          tabIndex={-1}
          aria-label="Sirala"
          {...dragHandle?.listeners}
          {...dragHandle?.attributes}
        >
          ⠿
        </button>

        {/* Avatar */}
        <MealAvatar meal={meal} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-white leading-tight">{meal.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-white">{meal.calories}</span>
            <span className="text-[10px] text-zinc-500">kcal</span>
            <span className="text-[10px] text-blue-400">P:{meal.protein}g</span>
            <span className="text-[10px] text-amber-400">C:{meal.carbs}g</span>
            <span className="text-[10px] text-rose-400">F:{meal.fat}g</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onToggleFavorite}
            className={`px-1 py-1 text-sm transition-colors ${meal.isFavorite ? "text-yellow-400" : "text-zinc-600 hover:text-zinc-400"}`}
          >
            {meal.isFavorite ? "★" : "☆"}
          </button>
          <button
            onClick={onToggleExpand}
            className="px-1 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? "▲" : "▼"}
          </button>
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
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold hover:bg-zinc-700"
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold">{amount || "1"}</span>
                <button
                  onClick={() => onAmountChange(String(Number(amount || 1) + 1))}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold hover:bg-zinc-700"
                >
                  +
                </button>
                <span className="text-xs text-zinc-500">adet</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`${meal.servingSize}`}
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  className="w-24 rounded-xl bg-zinc-800 px-3 py-1.5 text-center text-sm outline-none focus:ring-1 focus:ring-zinc-600"
                />
                <span className="text-xs text-zinc-500">{meal.servingLabel}</span>
              </div>
            )}
            {preview && (
              <span className="ml-auto text-[10px] text-zinc-500">
                → <span className="text-zinc-300 font-semibold">{preview.calories}</span> kcal
                &nbsp;P:{preview.protein}g C:{preview.carbs}g F:{preview.fat}g
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
              {added ? "Eklendi ✓" : dateParam ? "Güne Ekle" : "Bugüne Ekle"}
            </button>
            <button
              onClick={onEdit}
              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs hover:bg-zinc-700 transition-colors"
            >
              ✏
            </button>
            <button
              onClick={onDelete}
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"meals" | "packs" | "categories">("meals");
  const [newPackName, setNewPackName] = useState("");
  const [expandedPack, setExpandedPack] = useState<string | null>(null);
  const [loggedPack, setLoggedPack] = useState<Record<string, boolean>>({});
  const [showFoodDB, setShowFoodDB] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

  // dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Data ───────────────────────────────────────────────────────────────────

  async function fetchAll() {
    const res  = await fetch("/api/meals/all");
    const data = await res.json();
    setMeals(data.meals ?? []);
    setPacks(data.packs ?? []);
    setCategories(data.categories ?? []);
  }

  useEffect(() => { fetchAll(); }, []);

  // ── Filtered / sorted meal lists ───────────────────────────────────────────

  const filteredMeals = useMemo(() => {
    const base = meals.filter((meal) => {
      const matchSearch = meal.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "ALL" ||
        (filter === "FAVORITES" ? meal.isFavorite : meal.categoryId === filter);
      return matchSearch && matchFilter;
    });
    return base;
  }, [meals, search, filter]);

  const favMeals  = useMemo(() => filteredMeals.filter((m) => m.isFavorite).sort((a, b) => a.orderIndex - b.orderIndex),  [filteredMeals]);
  const restMeals = useMemo(() => filteredMeals.filter((m) => !m.isFavorite).sort((a, b) => a.orderIndex - b.orderIndex), [filteredMeals]);

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

      // Optimistic local update
      setMeals((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        allOrdered.forEach((m, i) => {
          const existing = map.get(m.id);
          if (existing) map.set(m.id, { ...existing, orderIndex: i });
        });
        return Array.from(map.values());
      });

      // Persist
      fetch("/api/meals/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: allOrdered.map((m, i) => ({ id: m.id, orderIndex: i })) }),
      }).catch(() => {});
    };
  }

  // ── Meal CRUD ──────────────────────────────────────────────────────────────

  async function saveMeal() {
    if (!form.name || form.calories === "") { alert("Isim ve kalori gerekli"); return; }
    const servingLabel = form.servingType;
    const servingSize  = form.servingType === "piece" ? 1 : Number(form.servingSize) || 100;
    const payload = {
      name:        form.name,
      calories:    Number(form.calories),
      protein:     Number(form.protein)  || 0,
      carbs:       Number(form.carbs)    || 0,
      fat:         Number(form.fat)      || 0,
      fiber:       Number(form.fiber)    || null,
      sodium:      Number(form.sodium)   || null,
      servingSize,
      servingLabel,
      categoryId:  form.categoryId || null,
      isFavorite:  form.isFavorite,
      imageUrl:    form.imageUrl.trim() || null,
    };
    const method = editingId ? "PUT" : "POST";
    const url    = editingId ? `/api/meals/${editingId}` : "/api/meals";
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
    // Optimistic update — no fetchAll() needed
    setMeals((prev) =>
      prev.map((m) => m.id === meal.id ? { ...m, isFavorite: !m.isFavorite } : m)
    );
    await fetch(`/api/meals/${meal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meal, isFavorite: !meal.isFavorite }),
    });
  }

  async function addMeal(meal: Meal) {
    const rawAmount = amounts[meal.id];
    const amount = rawAmount ? Number(rawAmount) : meal.servingLabel === "piece" ? 1 : meal.servingSize;
    if (!amount || amount <= 0) { alert("Gecerli bir miktar girin"); return; }
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

  function editMeal(meal: Meal) {
    setEditingId(meal.id);
    const servingType: ServingType =
      meal.servingLabel === "g" ? "g" : meal.servingLabel === "ml" ? "ml" : "piece";
    setForm({
      name:        meal.name,
      calories:    String(meal.calories),
      protein:     String(meal.protein),
      carbs:       String(meal.carbs),
      fat:         String(meal.fat),
      fiber:       String(meal.fiber ?? ""),
      sodium:      String(meal.sodium ?? ""),
      servingSize: String(meal.servingSize),
      servingType,
      categoryId:  meal.categoryId ?? "",
      isFavorite:  meal.isFavorite,
      imageUrl:    meal.imageUrl ?? "",
    });
    setShowForm(true);
    setActiveTab("meals");
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
        protein:  acc.protein  + item.meal.protein  * item.quantity,
        carbs:    acc.carbs    + item.meal.carbs     * item.quantity,
        fat:      acc.fat      + item.meal.fat       * item.quantity,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  const displayDate = dateParam
    ? new Date(dateParam + "T12:00:00").toLocaleDateString("tr-TR", {
        weekday: "long", day: "numeric", month: "long",
      })
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-2xl p-4 pb-28">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Meals</h1>
          {displayDate ? (
            <p className="text-xs text-amber-400">{displayDate} icin ekleniyor</p>
          ) : (
            <p className="text-xs text-zinc-500">Kisisel yemek kutuphanesi</p>
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
          {/* Search + filter bar */}
          <div className="mb-3 space-y-2">
            <div className="flex gap-2">
              <input
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-400 outline-none"
              >
                <option value="ALL">Tumu</option>
                <option value="FAVORITES">Favoriler</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                ))}
              </select>
            </div>

            {/* Action buttons row */}
            <div className="flex gap-2">
              {/* + New Meal toggle */}
              <button
                onClick={() => {
                  if (showForm && editingId) { resetForm(); }
                  setShowForm((v) => !v);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  showForm
                    ? "border border-zinc-600 bg-zinc-800 text-zinc-300"
                    : "bg-green-600 text-white hover:bg-green-500"
                }`}
              >
                {showForm ? "✕ Kapat" : "+ Yeni Yemek"}
              </button>
              <button
                onClick={() => setShowFoodDB(true)}
                className="flex-1 rounded-xl border border-blue-800 bg-blue-950/40 py-2 text-xs font-bold text-blue-400 hover:bg-blue-900/40 transition-colors"
              >
                Gida Veritabani
              </button>
              {AI_ENABLED && (
                <button
                  onClick={() => setShowAI(true)}
                  className="flex-1 rounded-xl border border-green-800 bg-green-950/40 py-2 text-xs font-bold text-green-400 hover:bg-green-900/40 transition-colors"
                >
                  AI Analiz
                </button>
              )}
            </div>
          </div>

          {/* ── New / Edit Meal Form (collapsible) ── */}
          {showForm && (
            <div className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                {editingId ? "Yemegi Duzenle" : "Yeni Yemek"}
              </p>
              <div className="space-y-2">
                <input
                  placeholder="Yemek adi"
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
                    <option value="">Kategori yok</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                    ))}
                  </select>
                  <select
                    value={form.servingType}
                    onChange={(e) => setForm((p) => ({ ...p, servingType: e.target.value as ServingType }))}
                    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-300 outline-none"
                  >
                    <option value="piece">Adet basina</option>
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
                    <span className="ml-auto text-[10px] text-zinc-600">makrolar bu miktar icindir</span>
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
                  <input type="number" placeholder="Yag (g)" value={form.fat}
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
                    Favorilere ekle
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={saveMeal}
                    className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-500 transition-colors"
                  >
                    {editingId ? "Guncelle" : "Kaydet"}
                  </button>
                  {editingId && (
                    <button
                      onClick={() => { resetForm(); setShowForm(false); }}
                      className="rounded-xl bg-zinc-800 px-4 text-sm hover:bg-zinc-700 transition-colors"
                    >
                      Iptal
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modals */}
          {showFoodDB && (
            <FoodDatabaseModal dateParam={dateParam} onClose={() => setShowFoodDB(false)} onAdded={fetchAll} />
          )}
          {showAI && (
            <AIMealAnalyzer dateParam={dateParam} onClose={() => setShowAI(false)} onAdded={fetchAll} />
          )}

          {/* ── Meal list ── */}
          <div className="space-y-1">

            {/* Favorites section */}
            {favMeals.length > 0 && (
              <>
                <p className="pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-600">
                  ★ Favoriler
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={makeDragEnd("fav")}
                >
                  <SortableContext items={favMeals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1">
                      {favMeals.map((meal) => (
                        <SortableMealCard
                          key={meal.id}
                          meal={meal}
                          expanded={expandedMeal === meal.id}
                          onToggleExpand={() => setExpandedMeal((v) => v === meal.id ? null : meal.id)}
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
              </>
            )}

            {/* Other meals section */}
            {restMeals.length > 0 && (
              <>
                {favMeals.length > 0 && (
                  <p className="pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Diger
                  </p>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={makeDragEnd("rest")}
                >
                  <SortableContext items={restMeals.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1">
                      {restMeals.map((meal) => (
                        <SortableMealCard
                          key={meal.id}
                          meal={meal}
                          expanded={expandedMeal === meal.id}
                          onToggleExpand={() => setExpandedMeal((v) => v === meal.id ? null : meal.id)}
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
              </>
            )}

            {filteredMeals.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-3xl">🥗</p>
                <p className="mt-2 text-sm font-semibold text-zinc-400">
                  {search ? "Sonuc bulunamadi" : "Henuz yemek yok"}
                </p>
                {!search && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-3 rounded-xl bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-500"
                  >
                    + Ilk yemegi ekle
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── PACKS TAB ── */}
      {activeTab === "packs" && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              placeholder="Pack adi (orn. Sabah Paketi)"
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPack()}
              className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
            />
            <button
              onClick={createPack}
              className="rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-500 transition-colors"
            >
              + Olustur
            </button>
          </div>

          <div className="space-y-3">
            {packs.length === 0 && (
              <p className="py-10 text-center text-sm text-zinc-500">Henuz pack yok.</p>
            )}
            {packs.map((pack) => {
              const totals     = packTotals(pack);
              const isExpanded = expandedPack === pack.id;
              return (
                <div key={pack.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{pack.name}</p>
                      <p className="text-[10px] text-zinc-500">{pack.items.length} yemek</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setExpandedPack(isExpanded ? null : pack.id)}
                        className="rounded-xl bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 transition-colors"
                      >
                        {isExpanded ? "Kapat" : "Duzenle"}
                      </button>
                      <button
                        onClick={() => logPack(pack.id)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          loggedPack[pack.id] ? "bg-green-800 text-green-300" : "bg-green-600 text-white hover:bg-green-500"
                        }`}
                      >
                        {loggedPack[pack.id] ? "Eklendi ✓" : "Hepsini Ekle"}
                      </button>
                      <button
                        onClick={() => deletePack(pack.id)}
                        className="rounded-xl bg-zinc-800 px-2.5 py-1.5 text-xs hover:bg-red-900/60 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px]">{Math.round(totals.calories)} kcal</span>
                    <span className="rounded-full bg-blue-950 px-2.5 py-0.5 text-[10px] text-blue-300">P:{Math.round(totals.protein)}g</span>
                    <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-[10px] text-amber-300">C:{Math.round(totals.carbs)}g</span>
                    <span className="rounded-full bg-rose-950 px-2.5 py-0.5 text-[10px] text-rose-300">F:{Math.round(totals.fat)}g</span>
                  </div>

                  {pack.items.length > 0 && (
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
                              onClick={() => updatePackItemQuantity(pack.id, item.id,
                                Math.max(item.meal.servingLabel === "piece" ? 1 : 0.5,
                                  item.quantity - (item.meal.servingLabel === "piece" ? 1 : 0.5)))}
                              className="rounded-lg bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
                            >
                              −
                            </button>
                            <span className="min-w-[3rem] text-center text-xs">
                              {item.meal.servingLabel === "piece"
                                ? `${item.quantity} adet`
                                : `${Math.round(item.quantity * item.meal.servingSize)}${item.meal.servingLabel}`}
                            </span>
                            <button
                              onClick={() => updatePackItemQuantity(pack.id, item.id,
                                item.quantity + (item.meal.servingLabel === "piece" ? 1 : 0.5))}
                              className="rounded-lg bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
                            >
                              +
                            </button>
                            {isExpanded && (
                              <button
                                onClick={() => removeMealFromPack(pack.id, item.id)}
                                className="ml-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Yemek Ekle</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {meals.filter((m) => !pack.items.some((i) => i.mealId === m.id)).map((meal) => (
                          <button
                            key={meal.id}
                            onClick={() => addMealToPack(pack.id, meal.id)}
                            className="flex w-full items-center justify-between rounded-xl bg-zinc-800 px-3 py-2 text-left hover:bg-zinc-700 transition-colors"
                          >
                            <span className="text-xs font-medium">{meal.name}</span>
                            <span className="text-[10px] text-zinc-500">
                              {meal.calories} kcal
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

      {/* ── CATEGORIES TAB ── */}
      {activeTab === "categories" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Kategori Ekle</p>
            <div className="flex gap-2">
              <input
                placeholder="🍽️"
                value={newCatEmoji}
                onChange={(e) => setNewCatEmoji(e.target.value)}
                className="w-14 rounded-xl bg-zinc-800 p-2 text-center text-lg outline-none"
              />
              <input
                placeholder="Kategori adi"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
                className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={createCategory}
                className="rounded-xl bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-500 transition-colors"
              >
                Ekle
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
                      <button onClick={() => setEditingCat(cat)} className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs hover:bg-zinc-700 transition-colors">✏</button>
                      <button onClick={() => deleteCategory(cat.id)} className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs hover:bg-red-900/60 transition-colors">✕</button>
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
    <Suspense fallback={<main className="p-4 text-zinc-400">Yukleniyor...</main>}>
      <MealsContent />
    </Suspense>
  );
}
