import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification, type PushPayload } from "@/lib/webpush";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userId, title, message, url } = body as {
    userId: string;
    title: string;
    message: string;
    url?: string;
  };

  if (!userId || !title || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: "No subscriptions found" });
  }

  const payload: PushPayload = { title, body: message, url };
  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload);
      if (!result.ok && result.gone) {
        // Clean up stale subscription
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
      return result;
    })
  );

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent, total: subscriptions.length });
}
