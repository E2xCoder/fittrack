import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // DB'yi de uyanık tut
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ status: "ok", time: Date.now() });
}