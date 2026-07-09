import { describe, expect, it } from "vitest";
import {
  epley1RM,
  getBestSet,
  computePlateauWeeks,
  currentStreak,
  longestStreak,
  pctChange,
} from "./fitness";

describe("epley1RM", () => {
  it("returns the weight itself for 1 rep... plus the Epley bump", () => {
    expect(epley1RM(100, 1)).toBe(103);
  });
  it("computes the classic 8-rep estimate", () => {
    expect(epley1RM(80, 8)).toBe(Math.round(80 * (1 + 8 / 30))); // 101
  });
  it("rounds to the nearest kg", () => {
    expect(epley1RM(62.5, 5)).toBe(73);
  });
});

describe("getBestSet", () => {
  it("returns null for empty or invalid sets", () => {
    expect(getBestSet([])).toBeNull();
    expect(getBestSet([{ weight: null, reps: 8 }, { weight: 50, reps: null }])).toBeNull();
  });
  it("picks the highest-volume set", () => {
    const best = getBestSet([
      { weight: 80, reps: 8 },  // 640
      { weight: 90, reps: 6 },  // 540
      { weight: 85, reps: 8 },  // 680 ← best
    ]);
    expect(best).toEqual({ weight: 85, reps: 8 });
  });
  it("excludes warmup sets below 70% of session max weight", () => {
    const best = getBestSet([
      { weight: 40, reps: 15 }, // warmup: 600 volume but < 70% of 100
      { weight: 100, reps: 5 }, // 500 ← should win
    ]);
    expect(best).toEqual({ weight: 100, reps: 5 });
  });
  it("treats zero weight as invalid", () => {
    expect(getBestSet([{ weight: 0, reps: 10 }])).toBeNull();
  });
});

describe("computePlateauWeeks", () => {
  const day = (offset: number) => new Date(Date.UTC(2026, 5, 1 + offset));
  const today = day(28);

  it("returns 0 with fewer than 3 sessions", () => {
    expect(computePlateauWeeks([{ date: day(0), volume: 600 }], today)).toBe(0);
  });
  it("returns 0 when volume is still increasing", () => {
    const history = [
      { date: day(0), volume: 600 },
      { date: day(7), volume: 640 },
      { date: day(14), volume: 680 },
    ];
    expect(computePlateauWeeks(history, today)).toBe(0);
  });
  it("counts weeks since the peak when volume stalls", () => {
    const history = [
      { date: day(0), volume: 600 },
      { date: day(7), volume: 700 }, // peak, 21 days before today
      { date: day(14), volume: 700 },
      { date: day(21), volume: 680 },
    ];
    expect(computePlateauWeeks(history, today)).toBe(3);
  });
});

describe("currentStreak", () => {
  it("returns 0 with no logs", () => {
    expect(currentStreak(new Set(), "2026-07-09")).toBe(0);
  });
  it("counts consecutive days ending today", () => {
    const logged = new Set(["2026-07-07", "2026-07-08", "2026-07-09"]);
    expect(currentStreak(logged, "2026-07-09")).toBe(3);
  });
  it("does not break the streak when today is not yet logged", () => {
    const logged = new Set(["2026-07-07", "2026-07-08"]);
    expect(currentStreak(logged, "2026-07-09")).toBe(2);
  });
  it("breaks on a gap before yesterday", () => {
    const logged = new Set(["2026-07-05", "2026-07-06", "2026-07-08"]);
    expect(currentStreak(logged, "2026-07-09")).toBe(1);
  });
  it("handles month boundaries", () => {
    const logged = new Set(["2026-06-29", "2026-06-30", "2026-07-01"]);
    expect(currentStreak(logged, "2026-07-01")).toBe(3);
  });
});

describe("longestStreak", () => {
  it("returns 0 for no dates", () => {
    expect(longestStreak([])).toBe(0);
  });
  it("finds the longest run anywhere in history", () => {
    expect(
      longestStreak([
        "2026-01-01", "2026-01-02",              // run of 2
        "2026-02-10", "2026-02-11", "2026-02-12", // run of 3
        "2026-03-01",
      ])
    ).toBe(3);
  });
  it("ignores duplicate dates", () => {
    expect(longestStreak(["2026-01-01", "2026-01-01", "2026-01-02"])).toBe(2);
  });
  it("handles year boundaries", () => {
    expect(longestStreak(["2025-12-31", "2026-01-01"])).toBe(2);
  });
});

describe("pctChange", () => {
  it("computes rounded percent change", () => {
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(90, 100)).toBe(-10);
    expect(pctChange(100, 3)).toBe(3233);
  });
  it("returns null with no baseline", () => {
    expect(pctChange(50, 0)).toBeNull();
  });
});
