import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      calorieTarget: true,
      proteinTarget: true,
      carbTarget: true,
      fatTarget: true,
    },
  });

  return NextResponse.json(user);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name,
      calorieTarget: Number(body.calorieTarget) || null,
      proteinTarget: Number(body.proteinTarget) || null,
      carbTarget: Number(body.carbTarget) || null,
      fatTarget: Number(body.fatTarget) || null,
    },
  });

  return NextResponse.json({ success: true });
}