// Pure fitness/statistics helpers shared by API routes. No I/O — unit-testable.

export interface SetLike {
  weight: number | null;
  reps: number | null;
}

export interface BestSet {
  weight: number;
  reps: number;
}

/** Estimated 1-rep max — Epley formula. */
export function epley1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Given the sets of one workout session, return the single best set:
 * - Exclude warmup sets: any set whose weight < 70 % of the session's max weight
 * - Among the remaining sets pick the one with the highest weight × reps volume
 */
export function getBestSet(sets: SetLike[]): BestSet | null {
  const valid = sets.filter((s) => s.weight && s.reps);
  if (valid.length === 0) return null;

  const maxWeight = Math.max(...valid.map((s) => s.weight!));
  const threshold = maxWeight * 0.7;
  const workSets = valid.filter((s) => s.weight! >= threshold);
  if (workSets.length === 0) return null;

  let best: BestSet | null = null;
  let bestVolume = 0;
  for (const s of workSets) {
    const volume = s.weight! * s.reps!;
    if (volume > bestVolume) {
      bestVolume = volume;
      best = { weight: s.weight!, reps: s.reps! };
    }
  }
  return best;
}

/**
 * Plateau: how many whole weeks the best-set volume has failed to exceed its
 * running max. Returns 0 with fewer than 3 sessions or when still progressing.
 * `history` is oldest → newest.
 */
export function computePlateauWeeks(
  history: { date: Date; volume: number }[],
  today: Date
): number {
  if (history.length < 3) return 0;
  let peak = 0;
  let peakDate = history[0].date;
  let stalledSince: Date | null = null;
  for (const h of history) {
    if (h.volume > peak) {
      peak = h.volume;
      peakDate = h.date;
      stalledSince = null;
    } else if (stalledSince === null) {
      stalledSince = peakDate;
    }
  }
  const newestVolume = history[history.length - 1].volume;
  if (newestVolume <= peak && stalledSince) {
    const days = Math.round((today.getTime() - stalledSince.getTime()) / 86400000);
    return Math.floor(days / 7);
  }
  return 0;
}

// ── Streaks ──────────────────────────────────────────────────────────────────
// Dates are "YYYY-MM-DD" day keys (already timezone-resolved by the caller).

function prevDayKey(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive logged days walking back from `todayKey`.
 * Today itself may be unlogged without breaking the streak (the day isn't over).
 */
export function currentStreak(loggedDays: Set<string>, todayKey: string): number {
  let streak = 0;
  let key = todayKey;
  if (!loggedDays.has(key)) key = prevDayKey(key);
  while (loggedDays.has(key)) {
    streak++;
    key = prevDayKey(key);
  }
  return streak;
}

/** Longest run of consecutive day keys ever. */
export function longestStreak(loggedDays: Iterable<string>): number {
  const sorted = [...new Set(loggedDays)].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    run = prev !== null && prevDayKey(key) === prev ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = key;
  }
  return longest;
}

/** Percent change from `prev` to `cur`; null when there is no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}
