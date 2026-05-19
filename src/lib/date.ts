export function getTodayInTimezone(): Date {
  const now = new Date();
  const berlinTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
  berlinTime.setHours(0, 0, 0, 0);
  return berlinTime;
}

export function toDateString(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}