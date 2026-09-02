import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/webpush";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subscriptions.length === 0) {
    return NextResponse.json({ error: "No subscription found. Enable notifications first." }, { status: 404 });
  }

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, {
        title: "FitTrack 🏋️",
        body: "Notifications are working!",
        url: "/dashboard",
        tag: "fittrack-test",
      });
      if (!result.ok && result.gone) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
      return result;
    })
  );

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent, total: subscriptions.length });
}
