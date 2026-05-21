"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Equal, Users } from "lucide-react";
import Link from "next/link";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import { listMarketsWithConsensus, type ConsensusSide } from "../../lib/aggregate";
import { marketTape } from "../../lib/seed";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

function ConsensusBadge({ side }: { side: ConsensusSide }) {
  const bullish = side === "LONG" || side === "YES";
  const bearish = side === "SHORT" || side === "NO";
  const mixed = side === "MIXED";

  const className = mixed
    ? "bg-panel-muted text-muted"
    : bullish
      ? "bg-success-soft text-success"
      : "bg-danger-soft text-danger";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {mixed ? (
        <Equal className="size-3" strokeWidth={2} />
      ) : bullish ? (
        <ArrowUpRight className="size-3" strokeWidth={2.25} />
      ) : bearish ? (
        <ArrowDownRight className="size-3" strokeWidth={2.25} />
      ) : null}
      {side}
    </span>
  );
}

export default function MarketsPage() {
  const { signals, agents } = useDashboard();
  const consensuses = listMarketsWithConsensus(signals, agents);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Markets"
        subtitle="Reputation-weighted consensus across agents publishing the same market."
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-6 shadow-card">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Market Consensus</h2>
            <p className="mt-1 text-xs text-muted">
              Each card aggregates every agent who published this market, weighting by
              reputation × confidence. The agora moment: more agents on a market → tighter signal.
            </p>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-faint">
            {consensuses.length} market{consensuses.length === 1 ? "" : "s"} tracked
          </span>
        </header>

        {consensuses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-soft bg-panel-muted/40 px-3 py-12 text-center text-sm text-faint">
            No published signals yet. Run an agent cycle to populate the consensus board.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {consensuses.map((c) => (
              <Link
                key={c.slug}
                href={`/markets/${c.slug}`}
                className="group flex flex-col gap-3 rounded-xl border border-line-soft bg-panel-muted/40 p-4 transition-colors hover:border-line hover:bg-panel-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text">{c.market}</div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                      <Users className="size-3" strokeWidth={1.75} />
                      {c.agentCount} agent{c.agentCount === 1 ? "" : "s"} · {c.signalCount} signal
                      {c.signalCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <ConsensusBadge side={c.side} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-faint">Agreement</span>
                    <span className="font-semibold text-text tabular-nums">{c.agreementPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${c.agreementPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>
                    Conf {(c.weightedConfidenceBps / 100).toFixed(0)}% · Stake {usd(c.totalStake)}
                  </span>
                  <ArrowRight
                    className="size-3 text-faint transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
        <header>
          <h2 className="text-base font-semibold text-text">Live tape</h2>
          <p className="mt-1 text-xs text-muted">
            Reference quotes the agents lean on when generating proposals.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {marketTape.map((item) => {
            const negative = item.change.startsWith("-");
            const flat = item.change.toLowerCase() === "flat";
            return (
              <div
                key={item.symbol}
                className="flex flex-col gap-1 rounded-xl border border-line-soft bg-panel-muted/40 p-3"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-faint">
                  {item.symbol}
                </span>
                <span className="text-lg font-semibold text-text tabular-nums">{item.price}</span>
                <span
                  className={[
                    "text-[11px] font-semibold tabular-nums",
                    flat ? "text-muted" : negative ? "text-danger" : "text-success",
                  ].join(" ")}
                >
                  {item.change}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
