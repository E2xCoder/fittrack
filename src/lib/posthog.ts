import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    capture_pageview: true,
    // Custom events (workout_saved, label_scanned, ...) and page views stay.
    // Session recording and click autocapture are off: they cost CPU and
    // bandwidth on the phone for data this app doesn't use.
    disable_session_recording: true,
    autocapture: false,
    loaded(ph) {
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export { posthog };
