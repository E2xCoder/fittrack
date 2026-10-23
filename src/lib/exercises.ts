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

// ── Fuzzy fallback for getExerciseInfo ──────────────────────────────────────
// Names logged before this dataset existed (or typed slightly differently —
// "Hammer Curl" vs the dataset's "Hammer Curls", "Bench Press" vs "Barbell
// Bench Press - Medium Grip") won't exact-match. Tokenize both sides, strip
// simple plurals, and accept a dataset entry if it contains every one of the
// query's words — then prefer the entry with the fewest *extra* words (the
// most generic/canonical match, e.g. "Barbell Squat" over "Barbell Full Squat"
// for a plain "Squat").

function stem(word: string): string {
  // "curls" -> "curl", "squats" -> "squat", but leave "press"/"cross" alone.
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[-'/]/g, " ")
    .split(/\s+/)
    .map(stem)
    .filter(Boolean);
}

const TOKENIZED = EXERCISE_DATA.map((e) => ({ entry: e, tokens: tokenize(e.name) }));

// When several matches tie on "fewest extra words", prefer the plain/default
// equipment variant (barbell, or bodyweight) over odd ones like "Car Deadlift"
// or "Clean Shrug" — that's almost always what a bare "Deadlift"/"Squat" meant.
const EQUIPMENT_RANK: Record<string, number> = { barbell: 0, "body only": 1 };
function equipmentRank(e: ExerciseInfo): number {
  return EQUIPMENT_RANK[e.equipment?.toLowerCase() ?? ""] ?? 2;
}

function fuzzyMatch(query: string): ExerciseInfo | null {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return null;

  let best: { entry: ExerciseInfo; extra: number; equip: number; length: number } | null = null;
  for (const { entry, tokens } of TOKENIZED) {
    if (!qTokens.every((t) => tokens.includes(t))) continue;
    const extra = tokens.length - qTokens.length;
    const equip = equipmentRank(entry);
    const length = entry.name.length;
    if (
      !best ||
      extra < best.extra ||
      (extra === best.extra && equip < best.equip) ||
      (extra === best.extra && equip === best.equip && length < best.length)
    ) {
      best = { entry, extra, equip, length };
    }
  }
  return best?.entry ?? null;
}

const infoCache = new Map<string, ExerciseInfo | null>();

// Case-insensitive exact lookup first, then a fuzzy fallback (memoized) for
// logged/typed names that don't match the dataset's exact wording. Returns
// null for genuinely custom exercises — callers should just skip the
// visual/info affordance in that case.
export function getExerciseInfo(name: string): ExerciseInfo | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;

  const exact = BY_NAME.get(key);
  if (exact) return exact;

  if (infoCache.has(key)) return infoCache.get(key)!;
  const fuzzy = fuzzyMatch(key);
  infoCache.set(key, fuzzy);
  return fuzzy;
}
