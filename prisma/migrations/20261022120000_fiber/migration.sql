-- Fibre: a daily goal on the user and the grams on each logged entry (null = not tracked).
ALTER TABLE "user" ADD COLUMN "fiberTarget" INTEGER;
ALTER TABLE "MealLog" ADD COLUMN "fiber" DOUBLE PRECISION;

-- Entries logged from a library meal that has fibre get it too (same scaling as calories).
UPDATE "MealLog" l
SET "fiber" = m."fiber" * l."quantity"
FROM "Meal" m
WHERE l."mealId" = m."id" AND m."fiber" IS NOT NULL AND l."fiber" IS NULL;
