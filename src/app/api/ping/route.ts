import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Keep the DB awake too
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ status: "ok", time: Date.now() });
}