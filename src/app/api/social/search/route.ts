import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const myId = session.user.id;

  const users = await prisma.user.findMany({
    where: {
      id: { not: myId },
      isPublic: true,
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { name:     { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, username: true },
    take: 15,
  });

  // Find existing friendships involving me + each result user
  const resultIds = users.map((u) => u.id);
  const existing = await prisma.friendship.findMany({
    where: {
      OR: [
        { userId: myId, friendId: { in: resultIds } },
        { userId: { in: resultIds }, friendId: myId },
      ],
    },
    select: { userId: true, friendId: true, status: true, id: true },
  });

  const enriched = users.map((u) => {
    const f = existing.find(
      (e) =>
        (e.userId === myId && e.friendId === u.id) ||
        (e.userId === u.id && e.friendId === myId)
    );
    return {
      ...u,
      friendshipId: f?.id ?? null,
      status: f?.status ?? null, // "pending" | "accepted" | null
    };
  });

  return NextResponse.json({ users: enriched });
}
