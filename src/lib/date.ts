export function getTodayInTurkey(): Date {
  const now = new Date();
  
  // Get current time in Turkey (GMT+2 / GMT+3 depending on DST)
  const turkeyTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })
  );
  
  // Return midnight of that date
  turkeyTime.setHours(0, 0, 0, 0);
  return turkeyTime;
}

export function toTurkeyDateString(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }); // "2026-05-19"
}