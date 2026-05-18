import { prisma }
from "@/lib/prisma";

interface SetInput {
  id: string;
  weight: number | null;
  reps: number | null;
}

export async function checkAndMarkPR(
  userId: string,
  exerciseName: string,
  newSet: SetInput
) {
  if (
    !newSet.weight ||
    !newSet.reps
  ) {
    return;
  }

  const previousSets =
    await prisma.exerciseSet.findMany({
      where: {
        exercise: {
          userId,
          name:
            exerciseName,
        },

        id: {
          not:
            newSet.id,
        },
      },

      select: {
        weight: true,
        reps: true,
      },
    });

  if (
    previousSets.length ===
    0
  ) {
    await prisma.exerciseSet.update(
      {
        where: {
          id:
            newSet.id,
        },

        data: {
          isPR: true,
        },
      }
    );

    return;
  }

  const newVolume =
    newSet.weight *
    newSet.reps;

  const isWeightPR =
    previousSets.every(
      (
        s
      ) =>
        (
          s.weight ??
          0
        ) <
        newSet.weight!
    );

  const isRepPR =
    previousSets
      .filter(
        (
          s
        ) =>
          s.weight ===
          newSet.weight
      )
      .every(
        (
          s
        ) =>
          (
            s.reps ??
            0
          ) <
        newSet.reps!
      );

  const isVolumePR =
    previousSets.every(
      (
        s
      ) =>
        (
          s.weight ??
          0
        ) *
        (
          s.reps ??
          0
        ) <
        newVolume
    );

  const isPR =
    isWeightPR ||
    isRepPR ||
    isVolumePR;

  if (isPR) {
    await prisma.exerciseSet.update(
      {
        where: {
          id:
            newSet.id,
        },

        data: {
          isPR: true,
        },
      }
    );
  }
}