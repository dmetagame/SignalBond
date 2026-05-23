"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [selectedIndex, setSelectedIndex] = useState(peakIndex);

  useEffect(() => {
    setSelectedIndex(peakIndex);
  }, [peakIndex]);

  const selectedBucket = buckets.find((bucket) => bucket.index === selectedIndex) ?? buckets[peakIndex];
  const selectedCount = selectedBucket?.count ?? 0;
  const totalCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const selectedShare = totalCount > 0 ? (selectedCount / totalCount) * 100 : 0;

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

      <div className="mt-2 grid h-32 grid-cols-7 items-end gap-2">
        {buckets.map((bucket) => {
          const heightPct = (bucket.count / maxForScale) * 100;
          const isPeak = bucket.index === peakIndex && hasActivity;
          const isSelected = bucket.index === selectedIndex;
          return (
            <button
              key={bucket.index}
              type="button"
              onClick={() => setSelectedIndex(bucket.index)}
              aria-pressed={isSelected}
              className="group flex h-full min-w-0 flex-col items-center justify-end gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <div className="relative flex w-full flex-1 items-end justify-center">
                {(isSelected || isPeak) && bucket.count > 0 && (
                  <span className="absolute -top-1 -translate-y-full rounded-md bg-text px-1.5 py-0.5 text-[10px] font-semibold text-bg tabular-nums">
                    {bucket.count}
                  </span>
                )}
                <span
                  className={[
                    "w-full rounded-md transition-colors group-hover:bg-accent/70",
                    isSelected
                      ? "bg-accent"
                      : isPeak
                        ? "bg-accent/70"
                        : bucket.count > 0
                          ? "bg-panel-muted"
                          : "bg-panel-muted/40",
                  ].join(" ")}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span
                className={[
                  "text-[11px] font-medium",
                  isSelected ? "text-text" : isPeak ? "text-muted" : "text-faint",
                ].join(" ")}
              >
                {bucket.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-line-soft bg-panel-muted p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-text">
              {selectedBucket?.label ?? "Day"} activity
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {selectedCount} signal{selectedCount === 1 ? "" : "s"} published
              {totalCount > 0 ? ` · ${selectedShare.toFixed(0)}% of activity` : ""}
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-text tabular-nums">
            {selectedCount}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${Math.max(selectedShare, selectedCount > 0 ? 8 : 0)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
