import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Errors are always reported; performance traces only for a small sample.
  tracesSampleRate: 0.05,

  // No session replay: it recorded the DOM of 10 % of visits (CPU on the phone)
  // and shipped ~100 KB of extra JavaScript on every page.

  // Don't print Sentry debug output to the console
  debug: false,
});
