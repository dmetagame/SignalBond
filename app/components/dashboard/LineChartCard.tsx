"use client";

import { MoreHorizontal } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import DeltaPill from "./DeltaPill";
import type { PerformancePoint } from "../../lib/performance";

const ACCENT = "#d4ff3e";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function LineChartCard({
  title,
  headlineUsd,
  returnBps,
  series,
  realizedDeltaUsd,
}: {
  title: string;
  headlineUsd: number;
  returnBps: number;
  series: PerformancePoint[];
  realizedDeltaUsd: number;
}) {
  const hasData = series.length >= 2;
  const returnPct = returnBps / 100;

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-xs text-muted">Aggregate weighted PnL across all agents</p>
        </div>
        <button
          type="button"
          aria-label="Card actions"
          className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-panel-muted hover:text-muted"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="text-4xl font-semibold tracking-tight text-text tabular-nums">
          {usd(headlineUsd)}
        </div>
        <DeltaPill value={returnPct} />
      </div>

      <div className="flex items-center gap-4 text-xs text-muted">
        <LegendDot color={ACCENT} label="Realized PnL" />
        <span className="text-faint">
          {hasData
            ? `${series.length - 1} signal events · ${realizedDeltaUsd >= 0 ? "+" : ""}${usd(realizedDeltaUsd)} over window`
            : "Not enough signal history yet"}
        </span>
      </div>

      <div className="mt-2 h-56 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perf-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="currentColor"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.55 }}
                minTickGap={32}
              />
              <YAxis
                stroke="currentColor"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor", opacity: 0.55 }}
                width={48}
                tickFormatter={(v: number) => usd(v)}
              />
              <Tooltip content={<PerfTooltip />} cursor={{ stroke: ACCENT, strokeOpacity: 0.3 }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={ACCENT}
                strokeWidth={2.5}
                fill="url(#perf-grad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line-soft bg-panel-muted/40 text-xs text-faint">
            Resolve at least 2 signals to populate this chart
          </div>
        )}
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function PerfTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0];
  const date = point.payload?.date as string | undefined;
  const value = typeof point.value === "number" ? point.value : 0;

  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-card">
      {date && (
        <div className="text-[10px] uppercase tracking-wider text-faint">
          {formatDate(date)}
        </div>
      )}
      <div className="font-semibold text-text tabular-nums">{usd(value)}</div>
    </div>
  );
}
