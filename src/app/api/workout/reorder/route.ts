import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { exercises?: { id: string; orderIndex: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const exercises = body.exercises ?? [];
  if (exercises.length === 0) return NextResponse.json({ success: true });

  // updateMany with userId guard ensures ownership — no exercise can be
  // reordered by a user who doesn't own it.
  await Promise.all(
    exercises.map(({ id, orderIndex }) =>
      prisma.exercise.updateMany({
        where: { id, userId: session.user.id },
        data: { orderIndex },
      })
    )
  );

  return NextResponse.json({ success: true });
}
