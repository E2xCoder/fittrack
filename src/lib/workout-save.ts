import type { PrismaClient } from "@prisma/client";

interface SetInput {
  weight?: number | null;
  reps?: number | null;
  sets?: number | null;
  rpe?: number | null;
}

export interface SaveWorkoutInput {
  userId: string;
  date: Date;
  split: string;
  notes: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exercises: any[];
}

/**
 * Replaces the saved exercises of (user, date, split) with the given list.
 *
 * Auto-save can fire several overlapping requests. Without serialisation two
 * of them both run "delete exercises" before either one runs "create", so the
 * exercise list ends up doubled (or tripled). The advisory lock makes every
 * save for the same workout run one after another inside one transaction, so
 * the last request simply wins. Workout has no unique key on
 * (user, date, split), so the same lock also stops two first saves from
 * creating two Workout rows.
 */
export async function saveWorkout(db: PrismaClient, input: SaveWorkoutInput) {
  const { userId, date, split, notes, exercises } = input;

  const exerciseData = (exercises ?? []).map((exercise, index) => ({
    name: exercise.name,
    userId,
    orderIndex: index,
    sets: {
      create: (exercise.sets ?? []).map((set: SetInput, i: number) => ({
        setNumber: i + 1,
        weight: set.weight ?? null,
        reps: set.reps ?? null,
        sets: set.sets ?? 1,
        rpe: set.rpe ?? null,
      })),
    },
  }));

  return db.$transaction(
    async (tx) => {
      const lockKey = `workout:${userId}:${date.toISOString().slice(0, 10)}:${split}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const existing = await tx.workout.findFirst({
        where: { userId, date, split },
        orderBy: { createdAt: "asc" },
      });

      if (existing) {
        await tx.exercise.deleteMany({ where: { workoutId: existing.id } });
        return tx.workout.update({
          where: { id: existing.id },
          data: { notes, exercises: { create: exerciseData } },
          include: { exercises: { include: { sets: true } } },
        });
      }

      return tx.workout.create({
        data: { userId, split, notes, date, exercises: { create: exerciseData } },
        include: { exercises: { include: { sets: true } } },
      });
    },
    { timeout: 20000, maxWait: 20000 }
  );
}
