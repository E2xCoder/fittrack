import type { ReactNode } from "react";
import Link from "next/link";

/** Uppercase, tracked section label used above every card group. */
export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
            {eyebrow}
          </p>
        )}
        {title && <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>}
      </div>
      {action}
    </div>
  );
}

/**
 * Hero stat: a big scannable number with a caption and optional trend delta.
 * Sizes follow the typography scale (hero numbers 3xl-4xl, bold).
 */
export function StatNumber({
  value,
  unit,
  label,
  color,
  size = "lg",
  trend,
}: {
  value: string | number;
  unit?: string;
  label?: string;
  color?: string;
  size?: "md" | "lg" | "xl";
  trend?: { value: string; positive: boolean };
}) {
  const numClass =
    size === "xl"
      ? "text-4xl"
      : size === "lg"
        ? "text-3xl"
        : "text-2xl";
  return (
    <div>
      {label && (
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </p>
      )}
      <p className={`${numClass} font-bold leading-tight tabular-nums`} style={color ? { color } : undefined}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-zinc-500">{unit}</span>}
      </p>
      {trend && (
        <p
          className="mt-0.5 text-xs font-semibold"
          style={{ color: trend.positive ? "#22c55e" : "#ef4444" }}
        >
          {trend.positive ? "▲" : "▼"} {trend.value}
        </p>
      )}
    </div>
  );
}

/** Motivational empty state with an always-present CTA. */
export function EmptyState({
  icon,
  title,
  message,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  icon?: string;
  title: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-3xl">{icon}</div>}
      <p className="text-base font-semibold text-white">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-zinc-400">{message}</p>}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCta && !ctaHref && (
        <button
          onClick={onCta}
          className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

/** Skeleton block for async loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-800/70 ${className}`} />;
}
