-- AlterTable: add role column with default "USER"
ALTER TABLE "user" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- Seed: promote admin account
UPDATE "user" SET "role" = 'ADMIN' WHERE "email" = '3mr3ren@gmail.com';
