-- AlterTable "user" — add social profile fields
ALTER TABLE "user" ADD COLUMN "username"      TEXT;
ALTER TABLE "user" ADD COLUMN "isPublic"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "shareSteps"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "shareCalories" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "shareWorkout"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "shareStreak"   BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateTable Friendship
CREATE TABLE "Friendship" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "friendId"  TEXT         NOT NULL,
    "status"    TEXT         NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Friendship_userId_friendId_key" ON "Friendship"("userId", "friendId");
CREATE INDEX "Friendship_userId_idx"   ON "Friendship"("userId");
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

ALTER TABLE "Friendship"
    ADD CONSTRAINT "Friendship_userId_fkey"
        FOREIGN KEY ("userId")   REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Friendship_friendId_fkey"
        FOREIGN KEY ("friendId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable WeeklyChallenge
CREATE TABLE "WeeklyChallenge" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "steps"     INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT "WeeklyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyChallenge_userId_weekStart_key" ON "WeeklyChallenge"("userId", "weekStart");
CREATE INDEX "WeeklyChallenge_userId_idx" ON "WeeklyChallenge"("userId");

ALTER TABLE "WeeklyChallenge"
    ADD CONSTRAINT "WeeklyChallenge_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
