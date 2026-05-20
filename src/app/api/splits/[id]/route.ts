import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const split = await prisma.userSplit.findFirst({ where: { id, userId: user.id } });
  if (!split) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.userSplit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  const split = await prisma.userSplit.findFirst({ where: { id, userId: user.id } });
  if (!split) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.userSplit.update({
    where: { id },
    data: {
      name: body.name ?? split.name,
      emoji: body.emoji ?? split.emoji,
    },
  });

  return NextResponse.json(updated);
}