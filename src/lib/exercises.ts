import exerciseData from "./exercise-data.json";

// Sourced from free-exercise-db (github.com/yuhonas/free-exercise-db, Unlicense —
// public domain). 870+ exercises with step-by-step instructions, muscle groups,
// equipment, and two images per movement (start/end position) used to fake a
// GIF by cross-fading between them. Images are served from jsdelivr's GitHub
// CDN so we never store/host the ~800 image pairs ourselves.
export interface ExerciseInfo {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[]; // relative paths, e.g. "Barbell_Curl/0.jpg"
}

const EXERCISE_DATA = exerciseData as ExerciseInfo[];

export const EXERCISE_IMAGE_BASE =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";

export function exerciseImageUrl(relativePath: string): string {
  return `${EXERCISE_IMAGE_BASE}${relativePath}`;
}

// Legacy curated list (kept as an always-instant fallback/seed — the full
// dataset below covers all of these and far more).
export const EXERCISES: string[] = EXERCISE_DATA.map((e) => e.name);

// name (lowercased) -> ExerciseInfo, built once.
const BY_NAME = new Map<string, ExerciseInfo>(EXERCISE_DATA.map((e) => [e.name.toLowerCase(), e]));

export function searchExercises(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const e of EXERCISE_DATA) {
    const name = e.name.toLowerCase();
    if (name.startsWith(q)) starts.push(e.name);
    else if (name.includes(q)) contains.push(e.name);
    if (starts.length >= 8) break;
  }
  return [...starts, ...contains].slice(0, 8);
}

// Exact (case-insensitive) lookup for showing images/muscles/instructions
// against an already-logged exercise name. Returns null for custom,
// user-typed exercises that aren't in the dataset — callers should just
// skip the visual/info affordance in that case.
export function getExerciseInfo(name: string): ExerciseInfo | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}
