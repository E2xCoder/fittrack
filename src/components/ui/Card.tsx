import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Three card tiers so visual weight maps to importance:
 *  - primary:      lighter surface, larger padding — hero / main content
 *  - secondary:    default surface — supporting info
 *  - interactive:  hover lift + pointer — clickable items
 */
type Tier = "primary" | "secondary" | "interactive";

const TIER_CLASS: Record<Tier, string> = {
  primary:
    "rounded-3xl border border-zinc-700/70 bg-zinc-900 p-5 md:p-6 shadow-lg shadow-black/20",
  secondary: "rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4",
  interactive:
    "rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 cursor-pointer transition " +
    "hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-800/70 hover:shadow-lg hover:shadow-black/30",
};

export function Card({
  tier = "secondary",
  className = "",
  children,
  accent,
}: {
  tier?: Tier;
  className?: string;
  children: ReactNode;
  accent?: string; // colored left border for typed cards
}) {
  return (
    <div
      className={`${TIER_CLASS[tier]} ${className}`}
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      {children}
    </div>
  );
}

/** Interactive card that navigates on click. */
export function LinkCard({
  href,
  className = "",
  children,
  accent,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={`${TIER_CLASS.interactive} block ${className}`}
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      {children}
    </Link>
  );
}
