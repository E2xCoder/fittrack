import { NextRequest, NextResponse } from "next/server";
import { strictLimit, apiLimit, searchLimit } from "@/lib/ratelimit";

// ─── Protected page routes ────────────────────────────────────────────────────

const protectedRoutes = [
  "/dashboard",
  "/meals",
  "/workout",
  "/analytics",
  "/profile",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1"
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

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate limiting for API routes ──────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = getIp(request);

    if (pathname.startsWith("/api/auth/")) {
      const { success, reset } = await strictLimit.limit(ip);
      if (!success)
        return tooManyRequests(Math.ceil((reset - Date.now()) / 1000));
    } else if (
      pathname.startsWith("/api/food-search") ||
      pathname.startsWith("/api/food-barcode")
    ) {
      const { success, reset } = await searchLimit.limit(ip);
      if (!success)
        return tooManyRequests(Math.ceil((reset - Date.now()) / 1000));
    } else {
      const { success, reset } = await apiLimit.limit(ip);
      if (!success)
        return tooManyRequests(Math.ceil((reset - Date.now()) / 1000));
    }

    return NextResponse.next();
  }

  // ── Auth guard for protected page routes (TEMPORARILY DISABLED) ───────────
  // const isProtected = protectedRoutes.some((route) =>
  //   pathname.startsWith(route)
  // );
  //
  // if (!isProtected) return NextResponse.next();
  //
  // const sessionToken =
  //   request.cookies.get("better-auth.session_token")?.value ??
  //   request.cookies.get("__Secure-better-auth.session_token")?.value;
  //
  // if (!sessionToken) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/meals/:path*",
    "/workout/:path*",
    "/analytics/:path*",
    "/profile/:path*",
  ],
};
