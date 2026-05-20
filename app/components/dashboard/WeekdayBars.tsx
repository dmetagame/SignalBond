import { MoreHorizontal } from "lucide-react";
import type { WeekdayBucket } from "../../lib/weekday";

export default function WeekdayBars({
  title,
  buckets,
  peakIndex,
  peakCount,
}: {
  title: string;
  buckets: WeekdayBucket[];
  peakIndex: number;
  peakCount: number;
}) {
  const maxForScale = Math.max(peakCount, 1);
  const peakLabel = buckets[peakIndex]?.label ?? "—";
  const hasActivity = peakCount > 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-xs text-muted">Signal publishing volume by weekday</p>
        </div>
        <button
          type="button"
          aria-label="Card actions"
          className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-panel-muted hover:text-muted"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-text tabular-nums">
          {hasActivity ? peakLabel : "—"}
        </span>
        <span className="text-sm font-semibold text-accent tabular-nums">
          {hasActivity ? `${peakCount} signal${peakCount === 1 ? "" : "s"}` : "No activity yet"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-7 items-end gap-2 h-32">
        {buckets.map((bucket) => {
          const heightPct = (bucket.count / maxForScale) * 100;
          const isPeak = bucket.index === peakIndex && hasActivity;
          return (
            <div key={bucket.index} className="flex h-full flex-col items-center justify-end gap-2">
              <div className="relative flex w-full flex-1 items-end justify-center">
                {isPeak && bucket.count > 0 && (
                  <span className="absolute -top-1 -translate-y-full rounded-md bg-text px-1.5 py-0.5 text-[10px] font-semibold text-bg tabular-nums">
                    {bucket.count}
                  </span>
                )}
                <span
                  className={[
                    "w-full rounded-md transition-colors",
                    isPeak ? "bg-accent" : bucket.count > 0 ? "bg-panel-muted" : "bg-panel-muted/40",
                  ].join(" ")}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span
                className={[
                  "text-[11px] font-medium",
                  isPeak ? "text-text" : "text-faint",
                ].join(" ")}
              >
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
