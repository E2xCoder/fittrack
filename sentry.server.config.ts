import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Errors are always reported; performance traces only for a small sample
  // (tracing every request added CPU and cold-start cost).
  tracesSampleRate: 0.05,

  debug: false,
});
