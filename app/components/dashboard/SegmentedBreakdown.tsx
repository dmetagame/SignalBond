import { MoreHorizontal } from "lucide-react";
import type { CompositionSegment } from "../../lib/composition";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export default function SegmentedBreakdown({
  title,
  segments,
  totalAgents,
  totalStake,
}: {
  title: string;
  segments: CompositionSegment[];
  totalAgents: number;
  totalStake: number;
}) {
  const totalForSegments = segments.reduce((sum, s) => sum + s.stake, 0) || 1;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-6 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-xs text-muted">
            {totalAgents} agent{totalAgents === 1 ? "" : "s"} · {usd(totalStake)} staked
          </p>
        </div>
        <button
          type="button"
          aria-label="Card actions"
          className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-panel-muted hover:text-muted"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {segments.map((segment) => {
          const pct = (segment.stake / totalForSegments) * 100;
          return (
            <div key={segment.category} className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
                {segment.category}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-text tabular-nums">
                  {segment.count}
                </span>
                <span className="text-xs text-muted tabular-nums">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: segment.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((segment) => {
          const pct = (segment.stake / totalForSegments) * 100;
          return (
            <span
              key={`bar-${segment.category}`}
              style={{ width: `${pct}%`, backgroundColor: segment.color }}
              className="h-full"
              title={`${segment.category} · ${usd(segment.stake)}`}
            />
          );
        })}
      </div>
    </section>
  );
}
