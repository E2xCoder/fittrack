import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification, type PushPayload } from "@/lib/webpush";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { title, message, url } = body as { title?: unknown; message?: unknown; url?: unknown };

  if (typeof title !== "string" || typeof message !== "string" || !title.trim() || !message.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Always the caller's own devices. This used to accept any userId, so any
  // signed-in account could push arbitrary text and links to any other user.
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: "No subscriptions found" });
  }

  // Only a path inside the app ("/dashboard"), never an external link.
  const safeUrl = typeof url === "string" && /^\/(?!\/)/.test(url) ? url : "/dashboard";
  const payload: PushPayload = { title: title.slice(0, 80), body: message.slice(0, 200), url: safeUrl };
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
