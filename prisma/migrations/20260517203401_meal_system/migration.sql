/*
  Warnings:

  - A unique constraint covering the columns `[userId,date]` on the table `DailyLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DailyLog" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalCalories" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalFat" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "ingredients" TEXT;

-- AlterTable
ALTER TABLE "MealLog" ADD COLUMN     "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dailyLogId" TEXT,
ADD COLUMN     "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "protein" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "DailyLog_userId_idx" ON "DailyLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_userId_date_key" ON "DailyLog"("userId", "date");

-- CreateIndex
CREATE INDEX "Meal_userId_idx" ON "Meal"("userId");

-- CreateIndex
CREATE INDEX "MealLog_mealId_idx" ON "MealLog"("mealId");

-- CreateIndex
CREATE INDEX "MealLog_userId_idx" ON "MealLog"("userId");

-- CreateIndex
CREATE INDEX "MealLog_dailyLogId_idx" ON "MealLog"("dailyLogId");
