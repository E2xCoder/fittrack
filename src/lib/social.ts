import { prisma } from "@/lib/prisma";

/** Monday 00:00 UTC of the current week */
export function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Consecutive-day streak ending today (or yesterday if today not yet logged). */
export async function calcStreak(
  userId: string
): Promise<{ streak: number; loggedToday: boolean; lastLogDate: Date | null }> {
  const logs = await prisma.dailyLog.findMany({
    where: { userId, totalCalories: { gt: 0 } },
    orderBy: { date: "desc" },
    take: 400,
    select: { date: true },
  });

  if (logs.length === 0) return { streak: 0, loggedToday: false, lastLogDate: null };

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const first = new Date(logs[0].date);
  first.setUTCHours(0, 0, 0, 0);
  const loggedToday = first.getTime() === todayUTC.getTime();

  // Expected start: today if logged today, otherwise yesterday
  const expected = new Date(loggedToday ? todayUTC : new Date(todayUTC));
  if (!loggedToday) expected.setUTCDate(expected.getUTCDate() - 1);

  let streak = 0;
  const cursor = new Date(expected);
  for (const { date } of logs) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() === cursor.getTime()) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return { streak, loggedToday, lastLogDate: new Date(logs[0].date) };
}
