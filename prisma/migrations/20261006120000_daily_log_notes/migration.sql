-- Free-text note for a day (shown on the dashboard). Nullable, so existing rows are untouched.
ALTER TABLE "DailyLog" ADD COLUMN "notes" TEXT;
