"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { parseMealType, type MealType } from "@/lib/meal-type";

// Drag a logged entry from one meal section to another (e.g. Snack → Breakfast).
// Shared by the dashboard and the Meals page; each page owns the actual move.

const DraggingContext = createContext(false);

// The section under the finger wins; closestCenter only covers drops that end
// in the gap between two sections.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

export function MealDndProvider({
  onMove,
  overlay,
  children,
}: {
  onMove: (logId: string, to: MealType) => void;
  overlay: (logId: string) => { name: string; calories: number } | null;
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Small distance threshold so taps on the row's buttons never start a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const to = parseMealType(event.over?.id);
    if (to) onMove(String(event.active.id), to);
  }

  const info = activeId ? overlay(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Empty sections appear when a drag starts and push the page down, so
      // their positions must be re-measured while dragging.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <DraggingContext.Provider value={activeId !== null}>{children}</DraggingContext.Provider>
      <DragOverlay dropAnimation={null}>
        {info && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-green-600 bg-zinc-900 px-3 py-2 shadow-xl">
            <span className="truncate text-sm font-medium text-white">{info.name}</span>
            <span className="text-xs tabular-nums text-zinc-400">{Math.round(info.calories)} kcal</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// One meal section. Empty sections stay hidden until a drag starts, so they can
// be used as drop targets without cluttering the page.
export function MealDropZone({
  type,
  label,
  empty,
  children,
}: {
  type: MealType;
  label: string;
  empty: boolean;
  children: ReactNode;
}) {
  const dragging = useContext(DraggingContext);
  const { setNodeRef, isOver } = useDroppable({ id: type });
  if (empty && !dragging) return null;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl transition ${isOver ? "ring-2 ring-green-500" : dragging ? "ring-1 ring-zinc-700" : ""}`}
    >
      {empty ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500">
          {label} · drop here
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// A draggable entry. `children` receives the grip handle to place in the row.
export function DraggableMeal({
  id,
  children,
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to another meal"
      className="touch-none cursor-grab select-none px-1 text-base leading-none text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
    >
      ⠿
    </button>
  );
  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-30" : undefined}>
      {children(handle)}
    </div>
  );
}
