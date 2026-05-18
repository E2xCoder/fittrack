import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const packs = await prisma.mealPack.findMany({
    where: { userId: user.id },
    include: {
      items: {
        include: { meal: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(packs);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const pack = await prisma.mealPack.create({
    data: {
      userId: user.id,
      name: body.name,
    },
    include: { items: { include: { meal: true } } },
  });

  return NextResponse.json(pack);
}