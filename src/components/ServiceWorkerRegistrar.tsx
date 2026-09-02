"use client";

import { useEffect } from "react";

/** Registers /sw.js once on mount. No permission prompts — those are
 *  handled explicitly from the Profile page. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[SW] registration failed", err));
  }, []);

  return null;
}
