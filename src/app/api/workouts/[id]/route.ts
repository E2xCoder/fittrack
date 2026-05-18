import { NextResponse }
from "next/server";

import { prisma }
from "@/lib/prisma";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } =
      await context.params;

    await prisma.exerciseSet.deleteMany(
      {
        where: {
          exercise: {
            workoutId:
              id,
          },
        },
      }
    );

    await prisma.exercise.deleteMany(
      {
        where: {
          workoutId:
            id,
        },
      }
    );

    await prisma.workout.delete(
      {
        where: {
          id,
        },
      }
    );

    return NextResponse.json(
      {
        success:
          true,
      }
    );
  } catch (
    error
  ) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        error:
          "Delete failed",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } =
      await context.params;

    const workout =
      await prisma.workout.findUnique(
        {
          where: {
            id,
          },

          include: {
            exercises:
              {
                include:
                  {
                    sets: true,
                  },
              },
          },
        }
      );

    return NextResponse.json(
      workout
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Failed",
      },
      {
        status: 500,
      }
    );
  }
}