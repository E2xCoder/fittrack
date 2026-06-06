import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  env: {
    TZ: "Europe/Istanbul",
    // Bridge SENTRY_DSN (server-only var) into the client bundle
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "",
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
