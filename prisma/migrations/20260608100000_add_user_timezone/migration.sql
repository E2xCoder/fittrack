-- Add timezone column to user table
ALTER TABLE "user" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin';
