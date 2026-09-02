import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100 % of transactions in dev/staging; lower in production if needed
  tracesSampleRate: 1.0,

  // Session replays: full replay on error, 10 % of normal sessions
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [Sentry.replayIntegration()],

  // Don't print Sentry debug output to the console
  debug: false,
});
