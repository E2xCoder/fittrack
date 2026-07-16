export function getTodayInTimezone(timezone = "Europe/Berlin"): Date {
  const now = new Date();
  const tzTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  tzTime.setHours(0, 0, 0, 0);
  return tzTime;
}

export function toDateString(date?: Date, timezone = "Europe/Berlin"): string {
  const d = date ?? new Date();
  return d.toLocaleDateString("en-CA", { timeZone: timezone });
}
