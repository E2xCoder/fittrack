import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/webpush";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const targetUserId = body.targetUserId as string | undefined;
  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  if (targetUserId === session.user.id) return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });

  // Verify target exists
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Upsert — avoid duplicate requests
  const existing = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: session.user.id, friendId: targetUserId } },
  });
  if (existing) return NextResponse.json({ friendship: existing });

  const friendship = await prisma.friendship.create({
    data: { userId: session.user.id, friendId: targetUserId, status: "pending" },
  });

  // Push notification to target (fire-and-forget)
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });
  const subs = await prisma.pushSubscription.findMany({ where: { userId: targetUserId } });
  const senderName = me?.name ?? "Biri";
  await Promise.allSettled(
    subs.map((sub) =>
      sendPushNotification(sub, {
        title: "Yeni arkadas istegi",
        body: `${senderName} seni arkadas olarak ekledi`,
        url: "/social",
        tag: `friend-request-${friendship.id}`,
      })
    )
  );

  return NextResponse.json({ friendship });
}
