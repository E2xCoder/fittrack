"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchExercises } from "@/lib/exercises";
import Link from "next/link";
import { posthog } from "@/lib/posthog";
import { Sparkline } from "@/components/ui/Sparkline";
import { RestTimer } from "@/components/ui/RestTimer";
import { METRICS, SEMANTIC } from "@/lib/metrics";
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
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Stable client IDs for dnd-kit ───────────────────────────────────────────

let _cid = 0;
function newClientId() { return `ex-${++_cid}`; }

// ─── Types ────────────────────────────────────────────────────────────────────

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
  clientId: string; // stable id for dnd-kit (never changes)
  id?: string;      // DB id (populated when loaded from server)
  name: string;
  sets: ExerciseSet[];
}

interface OverloadBest {
  weight: number;
  reps: number;
}

interface OverloadData {
  lastBestSet: OverloadBest | null;
  prevBestSet: OverloadBest | null;
  suggestion: string | null;
  isPR: boolean;
  est1RM?: number | null;
  history?: { date: string; volume: number }[];
  plateauWeeks?: number;
}

interface WorkoutAIRecap {
  summary: string;
  wins: string[];
  focus: string[];
  caution: string | null;
}

type SaveStatus = "idle" | "saving" | "saved";

// ─── Colour palette ───────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { border: "#22c55e", text: "text-green-400",   ring: "focus:ring-green-800"   },
  { border: "#60a5fa", text: "text-blue-400",    ring: "focus:ring-blue-800"    },
  { border: "#c084fc", text: "text-purple-400",  ring: "focus:ring-purple-800"  },
  { border: "#fb923c", text: "text-orange-400",  ring: "focus:ring-orange-800"  },
  { border: "#f472b6", text: "text-pink-400",    ring: "focus:ring-pink-800"    },
  { border: "#34d399", text: "text-emerald-400", ring: "focus:ring-emerald-800" },
];
function accentFor(i: number) { return ACCENT_COLORS[i % ACCENT_COLORS.length]; }

// ─── Compact input ────────────────────────────────────────────────────────────

function SetInput({ value, placeholder, onChange, ringClass }: {
  value: string; placeholder: string;
  onChange: (v: string) => void; ringClass: string;
}) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 text-center text-xs font-semibold text-white outline-none focus:ring-1 ${ringClass} placeholder:text-zinc-600`}
    />
  );
}

// Weight/reps input with thumb-sized − / + steppers so sets can be logged
// without opening the keyboard.
function StepperInput({ value, step, placeholder, onChange, ringClass }: {
  value: string; step: number; placeholder: string;
  onChange: (v: string) => void; ringClass: string;
}) {
  const num = () => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  return (
    <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Decrease"
        onClick={() => onChange(fmt(Math.max(0, num() - step)))}
        className="w-7 shrink-0 select-none text-sm font-bold text-zinc-400 transition-colors active:bg-zinc-600 hover:bg-zinc-700"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full min-w-0 bg-transparent text-center text-xs font-semibold text-white outline-none focus:ring-1 ${ringClass} placeholder:text-zinc-600`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Increase"
        onClick={() => onChange(fmt(num() + step))}
        className="w-7 shrink-0 select-none text-sm font-bold text-zinc-400 transition-colors active:bg-zinc-600 hover:bg-zinc-700"
      >
        +
      </button>
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

interface DragHandleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: Record<string, any>;
}

// Compare an entered set against last session's best set → PR/down/neutral.
function setTone(set: ExerciseSet, best: OverloadBest | null): "up" | "down" | "neutral" {
  if (!best) return "neutral";
  const w = Number(set.weight);
  const r = Number(set.reps);
  if (!w || !r) return "neutral";
  const vol = w * r;
  const bestVol = best.weight * best.reps;
  if (vol > bestVol) return "up";
  if (vol < bestVol) return "down";
  return "neutral";
}
const TONE_BORDER: Record<"up" | "down" | "neutral", string> = {
  up: SEMANTIC.success,
  down: SEMANTIC.warning,
  neutral: "#3f3f46",
};

function ExerciseCard({
  exercise, exIdx, overload,
  onRemove, onAddSet, onRemoveSet, onUpdateSet, onRest,
  dragHandle,
}: {
  exercise: Exercise;
  exIdx: number;
  overload?: OverloadData;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onUpdateSet: (setIdx: number, field: keyof ExerciseSet, value: string) => void;
  onRest: () => void;
  dragHandle?: DragHandleProps;
}) {
  const acc = accentFor(exIdx);
  const history = overload?.history?.map((h) => h.volume) ?? [];

  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
      style={{ boxShadow: `0 0 24px -8px ${acc.border}30`, borderLeftColor: acc.border, borderLeftWidth: 3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
        <div className="flex items-center gap-1 min-w-0">
          {/* Drag handle — 6-dot grip icon */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing shrink-0 select-none text-[13px] leading-none text-zinc-600 hover:text-zinc-400"
            style={{ touchAction: "none" }}
            tabIndex={-1}
            aria-label="Reorder exercise"
            {...dragHandle?.listeners}
            {...dragHandle?.attributes}
          >
            ⠿
          </button>
          <span className={`text-[10px] font-bold ${acc.text}`}>#{exIdx + 1}</span>
          <span className="truncate text-xs font-bold text-white leading-tight">{exercise.name}</span>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove exercise"
          className="ml-1 shrink-0 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Previous performance + 1RM + trend sparkline */}
      {overload?.lastBestSet && (
        <div className="mx-2 mb-1 flex items-center justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate text-[9px] text-zinc-400">
              Last: <span className="font-semibold text-green-400">{overload.lastBestSet.weight}kg × {overload.lastBestSet.reps}</span>
              {overload.est1RM ? <span className="text-zinc-600"> · 1RM ~{overload.est1RM}kg</span> : null}
            </p>
          </div>
          {history.length >= 2 && (
            <Sparkline data={history} color={acc.border} width={44} height={16} />
          )}
        </div>
      )}

      {/* PR / suggestion / plateau badges */}
      {overload?.isPR ? (
        <div className="mx-2 mb-1 inline-flex rounded bg-green-950/60 px-1.5 py-0.5 border border-green-900/40">
          <span className="text-[9px] font-semibold text-green-400">🏆 PR</span>
        </div>
      ) : overload?.suggestion ? (
        <div className="mx-2 mb-1 rounded bg-blue-950/40 px-1.5 py-0.5">
          <span className="text-[9px]" style={{ color: METRICS.protein.hex }}>
            💡 {overload.suggestion}
          </span>
        </div>
      ) : null}
      {overload?.plateauWeeks && overload.plateauWeeks >= 3 ? (
        <div className="mx-2 mb-1 rounded bg-amber-950/40 px-1.5 py-0.5">
          <span className="text-[9px] text-amber-400">
            ⚠️ Stuck for {overload.plateauWeeks} weeks — try a variation
          </span>
        </div>
      ) : null}

      {/* Column headers */}
      <div className="grid grid-cols-[2.4fr_2.2fr_1fr_1fr_14px] gap-0.5 px-2 pb-0.5">
        {["kg", "Rep", "Set", "RPE", ""].map((h, i) => (
          <span key={i} className="text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{h}</span>
        ))}
      </div>

      {/* Set rows */}
      <div className="space-y-0.5 px-2 pb-1.5">
        {exercise.sets.map((set, setIdx) => {
          const tone = setTone(set, overload?.lastBestSet ?? null);
          return (
            <div
              key={setIdx}
              className="grid grid-cols-[2.4fr_2.2fr_1fr_1fr_14px] items-center gap-0.5 rounded pl-1"
              style={{ borderLeft: `2px solid ${TONE_BORDER[tone]}` }}
            >
              <StepperInput value={set.weight} step={2.5} placeholder="—" onChange={(v) => onUpdateSet(setIdx, "weight", v)} ringClass={acc.ring} />
              <StepperInput value={set.reps}   step={1}   placeholder="—" onChange={(v) => onUpdateSet(setIdx, "reps",   v)} ringClass={acc.ring} />
              <SetInput value={set.sets}   placeholder="1" onChange={(v) => onUpdateSet(setIdx, "sets",   v)} ringClass={acc.ring} />
              <SetInput value={set.rpe}    placeholder="—" onChange={(v) => onUpdateSet(setIdx, "rpe",    v)} ringClass={acc.ring} />
              <button
                onClick={() => onRemoveSet(setIdx)}
                aria-label="Remove set"
                className={`text-center text-[10px] leading-none transition-colors ${
                  exercise.sets.length > 1 ? "text-zinc-700 hover:text-red-400" : "invisible"
                }`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer: add set + rest timer */}
      <div className="grid grid-cols-2">
        <button
          onClick={onAddSet}
          className="bg-zinc-800/40 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          + set
        </button>
        <button
          onClick={onRest}
          className="border-l border-zinc-800 bg-zinc-800/40 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-green-300 transition-colors"
        >
          ⏱ rest
        </button>
      </div>
    </div>
  );
}

// ─── Sortable wrapper ─────────────────────────────────────────────────────────

function SortableExerciseCard(props: Omit<React.ComponentProps<typeof ExerciseCard>, "dragHandle">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.exercise.clientId });

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
      <ExerciseCard {...props} dragHandle={{ listeners, attributes }} />
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-2 animate-pulse">
      <div className="mb-2 h-3 w-2/3 rounded bg-zinc-800" />
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-4 gap-0.5">
            {[1, 2, 3, 4].map((j) => <div key={j} className="h-6 rounded-md bg-zinc-800" />)}
          </div>
        ))}
      </div>
      <div className="mt-2 h-5 rounded-b bg-zinc-800/60" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkoutPage() {
  const [splits, setSplits] = useState<UserSplit[]>([]);
  const [selectedSplit, setSelectedSplit] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [notes, setNotes] = useState("");
  const [overloadData, setOverloadData] = useState<Record<string, OverloadData>>({});
  const [showSplitManager, setShowSplitManager] = useState(false);
  const [newSplitName, setNewSplitName] = useState("");
  const [newSplitEmoji, setNewSplitEmoji] = useState("🏋️");
  const [aiRecap, setAiRecap] = useState<WorkoutAIRecap | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showRest, setShowRest] = useState(false);
  const [autoRest, setAutoRest] = useState(true);
  const autoRestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const sessionStartRef = useRef<number | null>(null);

  const inputRef      = useRef<HTMLInputElement>(null);
  const isReadyRef    = useRef(false);
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-fresh refs for the auto-save closure
  const exercisesRef  = useRef<Exercise[]>([]);
  const notesRef      = useRef("");
  const splitRef      = useRef("");

  useEffect(() => {
    exercisesRef.current = exercises;
    notesRef.current = notes;
    splitRef.current = selectedSplit;
  }, [exercises, notes, selectedSplit]);

  // dnd-kit sensors — require 8px drag before activating (prevents accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Auto-save ──────────────────────────────────────────────────────────────

  function scheduleSave(delayMs = 1000) {
    if (!isReadyRef.current) return;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doAutoSave, delayMs);
  }

  async function doAutoSave() {
    const exs   = exercisesRef.current;
    const n     = notesRef.current;
    const split = splitRef.current;
    try {
      await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split,
          notes: n,
          exercises: exs.map((ex, i) => ({
            name: ex.name,
            orderIndex: i,
            sets: ex.sets.map((s, j) => ({
              setNumber: j + 1,
              weight: Number(s.weight) || null,
              reps:   Number(s.reps)   || null,
              sets:   Number(s.sets)   || 1,
              rpe:    Number(s.rpe)    || null,
            })),
          })),
        }),
      });
      posthog.capture("workout_saved", { split, exerciseCount: exs.length });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = exercisesRef.current.findIndex((ex) => ex.clientId === String(active.id));
    const newIdx = exercisesRef.current.findIndex((ex) => ex.clientId === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(exercisesRef.current, oldIdx, newIdx);
    setExercises(reordered);

    // Fire-and-forget reorder API if all exercises have DB IDs
    const allHaveIds = reordered.every((ex) => ex.id);
    if (allHaveIds && reordered.length > 0) {
      fetch("/api/workout/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercises: reordered.map((ex, i) => ({ id: ex.id, orderIndex: i })),
        }),
      }).catch(() => {});
    }

    scheduleSave(300);
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const res  = await fetch("/api/workouts/init");
        const data = await res.json();
        const loadedSplits: UserSplit[] = data.splits ?? [];
        setSplits(loadedSplits);
        if (loadedSplits.length > 0) {
          const firstSplit = loadedSplits[0].name;
          setSelectedSplit(firstSplit);
          if (data.workout) {
            setNotes(data.workout.notes ?? "");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loaded: Exercise[] = (data.workout.exercises ?? []).map((ex: any) => ({
              clientId: newClientId(),
              id: ex.id,
              name: ex.name,
              sets: (ex.sets ?? []).length > 0
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? ex.sets.map((s: any) => ({
                    setNumber: s.setNumber,
                    weight: s.weight ? String(s.weight) : "",
                    reps:   s.reps   ? String(s.reps)   : "",
                    sets:   s.sets   ? String(s.sets)   : "1",
                    rpe:    s.rpe    ? String(s.rpe)    : "",
                  }))
                : [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }],
            }));
            setExercises(loaded);
            // eslint-disable-next-line react-hooks/immutability
            loaded.forEach((ex) => fetchOverload(ex.name));
          }
        }
      } catch {
        // init failed — empty state, user can still add exercises
      }
      isReadyRef.current = true;
    }
    init();
  }, []);

  // ── Splits ─────────────────────────────────────────────────────────────────

  async function fetchSplits() {
    const res = await fetch("/api/splits");
    setSplits(await res.json());
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
    setOverloadData({});
    setNotes("");
    setSplitLoading(true);
    isReadyRef.current = false; // pause auto-save during split load
    try {
      const res  = await fetch(`/api/workouts/init?split=${encodeURIComponent(splitName)}`);
      const data = await res.json();
      if (data.workout) {
        setNotes(data.workout.notes ?? "");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded: Exercise[] = (data.workout.exercises ?? []).map((ex: any) => ({
          clientId: newClientId(),
          id: ex.id,
          name: ex.name,
          sets: (ex.sets ?? []).length > 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ex.sets.map((s: any) => ({
                setNumber: s.setNumber,
                weight: s.weight ? String(s.weight) : "",
                reps:   s.reps   ? String(s.reps)   : "",
                sets:   s.sets   ? String(s.sets)   : "1",
                rpe:    s.rpe    ? String(s.rpe)    : "",
              }))
            : [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }],
        }));
        setExercises(loaded);
        loaded.forEach((ex) => fetchOverload(ex.name));
      }
    } catch {
      // fetch failed — keep empty state
    }
    setSplitLoading(false);
    isReadyRef.current = true;
  }

  async function deleteSplit(id: string) {
    await fetch(`/api/splits/${id}`, { method: "DELETE" });
    fetchSplits();
  }

  // ── Exercises ──────────────────────────────────────────────────────────────

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
      { clientId: newClientId(), name: exerciseName, sets: [{ setNumber: 1, weight: "", reps: "", sets: "1", rpe: "" }] },
    ]);
    fetchOverload(exerciseName);
    setNewExerciseName("");
    setSuggestions([]);
    scheduleSave(300);
  }

  async function fetchOverload(exerciseName: string) {
    try {
      const res  = await fetch(`/api/workout/previous?exerciseName=${encodeURIComponent(exerciseName)}`);
      const data = await res.json();
      setOverloadData((prev) => ({ ...prev, [exerciseName]: data }));
    } catch {
      // badge just won't show
    }
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
    scheduleSave(300);
  }

  function addSet(exIdx: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const last = updated[exIdx].sets[updated[exIdx].sets.length - 1];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: [
          ...updated[exIdx].sets,
          { setNumber: updated[exIdx].sets.length + 1, weight: last?.weight ?? "", reps: last?.reps ?? "", sets: "1", rpe: "" },
        ],
      };
      return updated;
    });
    scheduleSave(300);
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: updated[exIdx].sets
          .filter((_, i) => i !== setIdx)
          .map((s, i) => ({ ...s, setNumber: i + 1 })),
      };
      return updated;
    });
    scheduleSave(300);
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof ExerciseSet, value: string) {
    const isComplete = (s: ExerciseSet) => Number(s.weight) > 0 && Number(s.reps) > 0;
    let becameComplete = false;
    setExercises((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIdx].sets];
      const before = sets[setIdx];
      const after = { ...before, [field]: value };
      becameComplete = !isComplete(before) && isComplete(after);
      sets[setIdx] = after;
      updated[exIdx] = { ...updated[exIdx], sets };
      return updated;
    });
    scheduleSave(1000); // debounced — user is still typing

    // Auto-start the rest timer once a set gets both weight and reps.
    // Short delay so it doesn't fire mid-typing.
    if (becameComplete && autoRest && !isRestDay) {
      if (autoRestTimeout.current) clearTimeout(autoRestTimeout.current);
      autoRestTimeout.current = setTimeout(() => triggerRest(), 1500);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const isRestDay      = selectedSplit === "Rest Day";
  const selectedSplitObj = splits.find((s) => s.name === selectedSplit);
  const canAnalyzeWorkout = exercises.some((exercise) =>
    exercise.sets.some((set) => set.weight.trim() || set.reps.trim())
  );

  // ── Live session stats (duration, volume, progress) ──
  // The session clock starts the moment the first set gets real values.
  const hasLoggedWork = exercises.some((ex) =>
    ex.sets.some((s) => Number(s.weight) > 0 && Number(s.reps) > 0)
  );

  useEffect(() => {
    if (isRestDay) return;
    if (hasLoggedWork && sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
      setSessionStarted(true);
    }
    if (sessionStartRef.current === null) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (sessionStartRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [hasLoggedWork, isRestDay]);

  const sessionStats = useMemo(() => {
    let volume = 0;
    let completedSets = 0;
    let loggedExercises = 0;
    for (const ex of exercises) {
      let exerciseHasWork = false;
      for (const s of ex.sets) {
        const w = Number(s.weight);
        const r = Number(s.reps);
        const count = Number(s.sets) || 1;
        if (w > 0 && r > 0) {
          volume += w * r * count;
          completedSets += count;
          exerciseHasWork = true;
        }
      }
      if (exerciseHasWork) loggedExercises++;
    }
    return { volume, completedSets, loggedExercises, total: exercises.length };
  }, [exercises]);

  function triggerRest() {
    setShowRest(false);
    // Re-mount the timer so tapping "rest" again restarts the countdown.
    requestAnimationFrame(() => setShowRest(true));
  }

  // Auto-rest preference persists across sessions.
  useEffect(() => {
    queueMicrotask(() => setAutoRest(localStorage.getItem("autoRest") !== "0"));
    return () => {
      if (autoRestTimeout.current) clearTimeout(autoRestTimeout.current);
    };
  }, []);

  function toggleAutoRest() {
    setAutoRest((v) => {
      localStorage.setItem("autoRest", v ? "0" : "1");
      return !v;
    });
  }

  function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  async function generateAiRecap() {
    if (!canAnalyzeWorkout || isRestDay) {
      setAiError("Once you log at least one working set, AI recap can analyze the session.");
      setAiRecap(null);
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch("/api/workout-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split: selectedSplit,
          notes,
          exercises: exercises.map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets.map((set) => ({
              weight: Number(set.weight) || null,
              reps: Number(set.reps) || null,
              sets: Number(set.sets) || 1,
              rpe: Number(set.rpe) || null,
            })),
          })),
          overloadData,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Workout recap failed.");
      }

      setAiRecap(json as WorkoutAIRecap);
    } catch (error) {
      setAiRecap(null);
      setAiError(error instanceof Error ? error.message : "Workout recap failed.");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-2xl p-4 pb-28">

      {/* ── Header ── */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Train</h1>
            {/* Auto-save indicator */}
            {saveStatus !== "idle" && (
              <span className={`text-[11px] font-medium transition-colors ${
                saveStatus === "saved" ? "text-green-500" : "text-zinc-500"
              }`}>
                {saveStatus === "saving" ? "Kaydediliyor..." : "Kaydedildi"}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">Log today&apos;s session</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => void generateAiRecap()}
            disabled={aiLoading || !canAnalyzeWorkout || isRestDay}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
          >
            {aiLoading ? "AI..." : "AI Recap"}
          </button>
          <Link
            href="/workout/history"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            History
          </Link>
          <button
            onClick={() => setShowSplitManager(!showSplitManager)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              showSplitManager
                ? "border-green-800 bg-green-950 text-green-400"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            Splits
          </button>
        </div>
      </div>

      {/* ── Split Manager ── */}
      {showSplitManager && (
        <div className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Manage Splits</p>
          <div className="mb-3 space-y-1.5">
            {splits.map((split) => (
              <div key={split.id} className="flex items-center justify-between rounded-xl bg-zinc-800 px-3 py-2">
                <span className="text-sm">{split.emoji} {split.name}</span>
                <button onClick={() => deleteSplit(split.id)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="🏋️"
              value={newSplitEmoji}
              onChange={(e) => setNewSplitEmoji(e.target.value)}
              className="w-14 rounded-xl bg-zinc-800 p-2 text-center text-lg outline-none"
            />
            <input
              placeholder="e.g. Push Day"
              value={newSplitName}
              onChange={(e) => setNewSplitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSplit()}
              className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-600"
            />
            <button onClick={createSplit} className="rounded-xl bg-green-600 px-3 text-sm font-bold hover:bg-green-500 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Split pills ── */}
      <div
        style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: "8px", paddingBottom: "4px", WebkitOverflowScrolling: "touch" }}
        className="mb-4"
      >
        {splits.map((split) => {
          const active = selectedSplit === split.name;
          return (
            <button
              key={split.id}
              onClick={() => handleSplitSelect(split.name)}
              style={{ flexShrink: 0, whiteSpace: "nowrap" }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                active
                  ? "bg-green-500 text-black shadow-lg shadow-green-500/30"
                  : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {split.emoji} {split.name}
            </button>
          );
        })}
      </div>

      {/* ── Active split / session bar ── */}
      {selectedSplitObj && !isRestDay && (
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedSplitObj.emoji}</span>
              <p className="text-sm font-bold text-zinc-200">{selectedSplitObj.name}</p>
            </div>
            <button
              onClick={toggleAutoRest}
              aria-pressed={autoRest}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                autoRest
                  ? "bg-green-950/60 text-green-400 border border-green-900/50"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}
            >
              ⏱ auto-rest {autoRest ? "on" : "off"}
            </button>
          </div>
          {/* Labeled progress bar */}
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
              <span>{sessionStats.loggedExercises}/{sessionStats.total} exercises logged</span>
              <span>{sessionStats.completedSets} sets</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${sessionStats.total ? (sessionStats.loggedExercises / sessionStats.total) * 100 : 0}%`,
                  backgroundColor: SEMANTIC.success,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Rest Day ── */}
      {isRestDay && (
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 py-10 text-center">
          <p className="text-5xl">😴</p>
          <p className="mt-3 font-bold text-zinc-200">Rest Day</p>
          <p className="mt-1 text-sm text-zinc-500">Recovery is part of the process.</p>
        </div>
      )}

      {/* ── Exercise section ── */}
      {!isRestDay && (aiRecap || aiError) && (
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">AI Recap</p>
              <p className="text-sm text-zinc-400">Manual on purpose, so it stays useful without burning credits.</p>
            </div>
            <button
              onClick={() => void generateAiRecap()}
              disabled={aiLoading || !canAnalyzeWorkout}
              className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
            >
              {aiLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {aiError ? (
            <p className="text-sm text-amber-400">{aiError}</p>
          ) : aiRecap ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-200">{aiRecap.summary}</p>

              {aiRecap.wins.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-400">Wins</p>
                  <div className="space-y-1">
                    {aiRecap.wins.map((item) => (
                      <p key={item} className="text-sm text-zinc-300">{item}</p>
                    ))}
                  </div>
                </div>
              )}

              {aiRecap.focus.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-400">Focus next</p>
                  <div className="space-y-1">
                    {aiRecap.focus.map((item) => (
                      <p key={item} className="text-sm text-zinc-300">{item}</p>
                    ))}
                  </div>
                </div>
              )}

              {aiRecap.caution && (
                <div className="rounded-xl border border-amber-900/40 bg-amber-950/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Watch-out</p>
                  <p className="mt-1 text-sm text-amber-100">{aiRecap.caution}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {!isRestDay && (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">+</span>
                <input
                  ref={inputRef}
                  placeholder="Search exercise..."
                  value={newExerciseName}
                  onChange={(e) => handleExerciseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addExercise();
                    if (e.key === "Escape") setSuggestions([]);
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={() => addExercise()}
                className="rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-500 transition-colors shadow-lg shadow-green-900/40"
              >
                + Add
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
                {suggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => { selectSuggestion(s); addExercise(s); }}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {s}
                  </button>
                ))}
                {newExerciseName && !suggestions.includes(newExerciseName) && (
                  <button
                    onClick={() => addExercise(newExerciseName)}
                    className="flex w-full items-center px-4 py-2.5 text-left text-sm text-green-400 hover:bg-zinc-800 transition-colors border-t border-zinc-800"
                  >
                    + Add &quot;{newExerciseName}&quot; as custom
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Exercise cards — draggable 2-column grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exercises.map((ex) => ex.clientId)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {splitLoading
                  ? [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
                  : exercises.map((exercise, exIdx) => (
                      <SortableExerciseCard
                        key={exercise.clientId}
                        exercise={exercise}
                        exIdx={exIdx}
                        overload={overloadData[exercise.name]}
                        onRemove={() => removeExercise(exIdx)}
                        onAddSet={() => addSet(exIdx)}
                        onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
                        onUpdateSet={(setIdx, field, value) => updateSet(exIdx, setIdx, field, value)}
                        onRest={triggerRest}
                      />
                    ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Notes */}
          {exercises.length > 0 && (
            <textarea
              placeholder="Workout notes (optional)"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); scheduleSave(1000); }}
              className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
              rows={2}
            />
          )}

          {/* Finish workout */}
          {hasLoggedWork && (
            <button
              onClick={() => { scheduleSave(0); setShowFinish(true); }}
              className="mt-3 w-full rounded-2xl bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-500"
            >
              Finish Workout
            </button>
          )}
        </>
      )}

      {/* ── Rest timer ── */}
      {showRest && <RestTimer initialDuration={90} onClose={() => setShowRest(false)} />}

      {/* ── Finish summary modal ── */}
      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setShowFinish(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-center">
              <p className="text-4xl">🎉</p>
              <h2 className="mt-2 text-xl font-bold text-white">Great work!</h2>
              <p className="text-sm text-zinc-400">{selectedSplitObj?.emoji} {selectedSplit}</p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-zinc-800/60 p-3">
                <p className="text-lg font-bold tabular-nums text-white">{sessionStarted ? fmtDuration(elapsed) : "—"}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Duration</p>
              </div>
              <div className="rounded-2xl bg-zinc-800/60 p-3">
                <p className="text-lg font-bold tabular-nums" style={{ color: METRICS.calories.hex }}>
                  {Math.round(sessionStats.volume).toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Hacim (kg)</p>
              </div>
              <div className="rounded-2xl bg-zinc-800/60 p-3">
                <p className="text-lg font-bold tabular-nums text-white">{sessionStats.completedSets}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Set</p>
              </div>
            </div>

            <p className="mb-4 text-center text-xs text-zinc-500">
              {sessionStats.loggedExercises} exercises completed · saved automatically ✓
            </p>

            <div className="flex gap-2">
              {!isRestDay && (
                <button
                  onClick={() => { setShowFinish(false); void generateAiRecap(); }}
                  disabled={aiLoading || !canAnalyzeWorkout}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-500 disabled:opacity-40"
                >
                  ✨ Get AI Recap
                </button>
              )}
              <button
                onClick={() => setShowFinish(false)}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
