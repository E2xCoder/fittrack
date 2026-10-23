import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The app is never meant to be embedded in another site (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera is needed (self) for the barcode scanner; nothing else is.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Every serverless function carried the whole Prisma runtime folder (~57 MB):
  // wasm builds for MySQL, SQLite, SQL Server and CockroachDB, the old query
  // engine and source maps. Only the PostgreSQL query compiler is used, and
  // smaller functions start faster.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@prisma/client/runtime/*.map",
      "node_modules/@prisma/client/runtime/*.mysql.*",
      "node_modules/@prisma/client/runtime/*.sqlite.*",
      "node_modules/@prisma/client/runtime/*.sqlserver.*",
      "node_modules/@prisma/client/runtime/*.cockroachdb.*",
      "node_modules/@prisma/client/runtime/query_engine_bg.*",
    ],
  },
  env: {
    TZ: "Europe/Istanbul",
    // Bridge SENTRY_DSN (server-only var) into the client bundle
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "",
    // Expose ONLY whether the OpenAI key exists (never the key itself) so the
    // client can hide the AI button when the feature isn't configured.
    NEXT_PUBLIC_AI_ENABLED: process.env.OPENAI_API_KEY ? "1" : "",
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress verbose Sentry CLI output during builds
  silent: true,

  // Strip Sentry SDK logger statements from production bundle
  disableLogger: true,

  // Upload slightly wider set of source maps for better stack traces
  widenClientFileUpload: true,

  // Delete source maps from the server after upload so they never reach the CDN
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
