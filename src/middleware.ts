import { NextRequest, NextResponse } from "next/server";
import { strictLimit, apiLimit, searchLimit } from "@/lib/ratelimit";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "127.0.0.1"
  );
}

function tooManyRequests(retryAfter: number) {
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfter),
      "Content-Type": "text/plain",
    },
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Page routes — no rate limiting
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const ip = getIp(req);

  // Auth endpoints — strictLimit (10 req/min)
  if (pathname.startsWith("/api/auth/")) {
    const { success, reset } = await strictLimit.limit(ip);
    if (!success) return tooManyRequests(Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.next();
  }

  // Food search & barcode — searchLimit (20 req/min)
  if (
    pathname.startsWith("/api/food-search") ||
    pathname.startsWith("/api/food-barcode")
  ) {
    const { success, reset } = await searchLimit.limit(ip);
    if (!success) return tooManyRequests(Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.next();
  }

  // All other API routes — apiLimit (60 req/min)
  const { success, reset } = await apiLimit.limit(ip);
  if (!success) return tooManyRequests(Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
