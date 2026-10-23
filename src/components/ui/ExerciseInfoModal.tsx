"use client";

import { useEffect, useState } from "react";
import { exerciseImageUrl, type ExerciseInfo } from "@/lib/exercises";

// Crossfades between the dataset's two still images (start/end position) to
// fake a movement GIF without needing to host or fetch actual GIF/video files.
function MovementPreview({ images, alt }: { images: string[]; alt: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % images.length), 900);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-800">
      {images.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img}
          src={exerciseImageUrl(img)}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: i === frame ? 1 : 0 }}
          loading="lazy"
        />
      ))}
    </div>
  );
}

function Tag({ children, tone = "zinc" }: { children: string; tone?: "zinc" | "green" }) {
  const cls =
    tone === "green"
      ? "bg-green-950/60 text-green-400 border-green-900/50"
      : "bg-zinc-800 text-zinc-300 border-zinc-700";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {children}
    </span>
  );
}

export function ExerciseInfoModal({ info, onClose }: { info: ExerciseInfo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <MovementPreview images={info.images} alt={info.name} />

          <div className="mt-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-white leading-tight">{info.name}</h2>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag tone="green">{info.level}</Tag>
            {info.equipment && <Tag>{info.equipment}</Tag>}
            <Tag>{info.category}</Tag>
          </div>

          {info.primaryMuscles.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Primary muscles</p>
              <div className="flex flex-wrap gap-1.5">
                {info.primaryMuscles.map((m) => <Tag key={m}>{m}</Tag>)}
              </div>
            </div>
          )}

          {info.secondaryMuscles.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Secondary muscles</p>
              <div className="flex flex-wrap gap-1.5">
                {info.secondaryMuscles.map((m) => <Tag key={m}>{m}</Tag>)}
              </div>
            </div>
          )}

          {info.instructions.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">How to</p>
              <ol className="space-y-1.5">
                {info.instructions.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300">
                    <span className="shrink-0 text-zinc-600">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
