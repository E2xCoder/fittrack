import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { meals?: { id: string; orderIndex: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const items = body.meals ?? [];
  if (items.length === 0) return NextResponse.json({ success: true });

  // userId guard — only update meals the user owns
  await Promise.all(
    items.map(({ id, orderIndex }) =>
      prisma.meal.updateMany({
        where: { id, userId: session.user.id },
        data: { orderIndex },
      })
    )
  );

  return NextResponse.json({ success: true });
}
