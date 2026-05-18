import { NextResponse }
from "next/server";

import { prisma }
from "@/lib/prisma";

export async function GET() {
  try {
    const workouts =
      await prisma.workout.findMany(
        {
          include: {
            exercises:
              {
                include:
                  {
                    sets: true,
                  },
              },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        }
      );

    return NextResponse.json(
      workouts
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
          "Failed to fetch workouts",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    await prisma.workout.deleteMany();

    const workout =
      await prisma.workout.create(
        {
          data: {
            title:
              body.title ??
              "Workout",

            notes:
              body.notes ??
              "",

            userId:
              "temp-user",

            exercises:
              {
                create:
                  (
                    body.exercises ??
                    []
                  ).map(
                    (
                      exercise: any
                    ) => ({
                      name:
                        exercise.name,

                      userId:
                        "temp-user",

                      sets:
                        {
                          create:
                            (
                              exercise.sets ??
                              []
                            ).map(
                              (
                                set: any
                              ) => ({
                                weight:
                                  set.weight ??
                                  null,

                                reps:
                                  set.reps ??
                                  null,
                              })
                            ),
                        },
                    })
                  ),
              },
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
  } catch (
    error
  ) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create workout",
      },
      {
        status: 500,
      }
    );
  }
}