"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initPostHog, posthog } from "@/lib/posthog";

interface Props {
  children: React.ReactNode;
}

export default function PostHogProvider({ children }: Props) {
  const pathname = usePathname();

  // Initialise once on mount and identify the logged-in user
  useEffect(() => {
    initPostHog();

    fetch("/api/user/me")
      .then((r) => r.json())
      .then((user) => {
        if (!user?.id) return;
        posthog.identify(user.id, {
          email: user.email,
          name: user.name,
        });
      })
      .catch(() => {});
  }, []);

  // Capture pageview on route change (SPA navigation)
  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return <>{children}</>;
}
