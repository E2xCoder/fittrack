import { percent } from "@/lib/metrics";

/** Horizontal progress bar, colored by metric hex. */
export function ProgressBar({
  value,
  target,
  color,
  height = 8,
  className = "",
  showOverfill = false,
}: {
  value: number;
  target: number;
  color: string;
  height?: number;
  className?: string;
  showOverfill?: boolean;
}) {
  const pct = showOverfill
    ? Math.min((value / (target || 1)) * 100, 130)
    : percent(value, target);
  const over = value > target;
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-zinc-800 ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={target}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${Math.min(pct, 100)}%`,
          backgroundColor: over && showOverfill ? "#ef4444" : color,
        }}
      />
    </div>
  );
}

/** SVG ring / donut for scores and single-metric progress. */
export function ProgressRing({
  value, // 0-100
  color,
  size = 120,
  stroke = 10,
  trackColor = "#27272a",
  children,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
