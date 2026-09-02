import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action as "accept" | "reject";
  if (!["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be accept or reject" }, { status: 400 });
  }

  // Only the recipient (friendId) can accept/reject
  const friendship = await prisma.friendship.findFirst({
    where: { id, friendId: session.user.id },
  });
  if (!friendship) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: action === "accept" ? "accepted" : "rejected" },
  });

  return NextResponse.json({ friendship: updated });
}
