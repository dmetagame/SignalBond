"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight, Equal, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDashboard } from "../../../components/dashboard/DashboardProvider";
import SectionHeader from "../../../components/dashboard/SectionHeader";
import {
  computeMarketConsensus,
  listMarketsWithConsensus,
  type ConsensusSide,
} from "../../../lib/aggregate";
import { formatBps, formatUsdc } from "../../../lib/reputation";

function ConsensusBadge({ side, large = false }: { side: ConsensusSide; large?: boolean }) {
  const bullish = side === "LONG" || side === "YES";
  const bearish = side === "SHORT" || side === "NO";
  const mixed = side === "MIXED";

  const tone = mixed
    ? "bg-panel-muted text-muted"
    : bullish
      ? "bg-success-soft text-success"
      : "bg-danger-soft text-danger";

  const size = large
    ? "px-3 py-1 text-sm font-semibold gap-1.5"
    : "px-2 py-0.5 text-[11px] font-semibold gap-1";

  const iconSize = large ? "size-4" : "size-3";

  return (
    <span className={`inline-flex items-center rounded-full ${size} ${tone}`}>
      {mixed ? (
        <Equal className={iconSize} strokeWidth={2} />
      ) : bullish ? (
        <ArrowUpRight className={iconSize} strokeWidth={2.25} />
      ) : bearish ? (
        <ArrowDownRight className={iconSize} strokeWidth={2.25} />
      ) : null}
      {side}
    </span>
  );
}

export default function MarketDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const { signals, agents } = useDashboard();

  const allConsensuses = listMarketsWithConsensus(signals, agents);
  const match = allConsensuses.find((c) => c.slug === symbol);

  if (!match) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <Link
          href="/markets"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          All markets
        </Link>
        <SectionHeader
          title="Market not found"
          subtitle="No signal has been published against this market yet."
        />
        <div className="rounded-2xl border border-dashed border-line-soft bg-panel-muted/40 px-3 py-12 text-center text-sm text-faint">
          Run an agent cycle and the market consensus will populate as signals roll in.
        </div>
      </div>
    );
  }

  const consensus = computeMarketConsensus(match.market, signals, agents) ?? match;
  const maxContribution = Math.max(
    ...consensus.contributors.map((c) => Math.abs(c.contribution)),
    1,
  );

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <Link
        href="/markets"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        All markets
      </Link>

      <SectionHeader
        title={consensus.market}
        subtitle={`${consensus.agentCount} agent${consensus.agentCount === 1 ? "" : "s"} weighing in across ${consensus.signalCount} signal${consensus.signalCount === 1 ? "" : "s"}.`}
        actions={<ConsensusBadge side={consensus.side} large />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Consensus side" value={consensus.side} />
        <Stat
          label="Agreement"
          value={`${consensus.agreementPct}%`}
          hint="Weighted directional alignment"
        />
        <Stat
          label="Weighted confidence"
          value={`${(consensus.weightedConfidenceBps / 100).toFixed(0)}%`}
        />
        <Stat label="Total stake" value={formatUsdc(consensus.totalStake)} />
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
        <header>
          <h2 className="text-base font-semibold text-text">Contributors</h2>
          <p className="mt-1 text-xs text-muted">
            Each agent&apos;s vote in the consensus, ordered by magnitude of contribution
            (reputation × confidence, signed by direction).
          </p>
        </header>

        <ul className="divide-y divide-line-soft">
          {consensus.contributors.map((contrib) => {
            const bullish = contrib.side === "LONG" || contrib.side === "YES";
            const widthPct = Math.max(
              4,
              (Math.abs(contrib.contribution) / maxContribution) * 100,
            );
            return (
              <li
                key={contrib.signal.id}
                className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-9 items-center justify-center rounded-lg text-xs font-semibold uppercase"
                    style={{
                      backgroundColor: `${contrib.agent.color}22`,
                      color: contrib.agent.color,
                      border: `1px solid ${contrib.agent.color}55`,
                    }}
                  >
                    {contrib.agent.handle.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text">
                        {contrib.agent.name}
                      </span>
                      <span
                        className={[
                          "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                          bullish
                            ? "bg-success-soft text-success"
                            : "bg-danger-soft text-danger",
                        ].join(" ")}
                      >
                        {contrib.side}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted">
                      Rep {contrib.reputation.toFixed(1)} · Conf{" "}
                      {(contrib.signal.confidenceBps / 100).toFixed(0)}% · Stake{" "}
                      {formatUsdc(contrib.signal.stakeUsdc)}
                      {contrib.signal.status === "settled" && (
                        <>
                          {" · "}
                          {contrib.signal.correct ? "won" : "lost"} {formatBps(contrib.signal.pnlBps ?? 0)}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:w-72">
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-panel-muted">
                    <span
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: bullish ? "#16a34a" : "#dc2626",
                      }}
                      className="h-full rounded-full"
                    />
                  </div>
                  <span
                    className={`w-16 text-right text-xs font-semibold tabular-nums ${
                      bullish ? "text-success" : "text-danger"
                    }`}
                  >
                    {bullish ? "+" : ""}
                    {contrib.contribution.toFixed(1)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed border-line-soft bg-panel-muted/30 p-4 text-xs text-muted">
        <p>
          <span className="font-semibold text-text">How this is computed:</span> each agent&apos;s
          published signal contributes <code>reputation × (confidenceBps / 10000)</code> to the
          market vote, signed by direction. Sums above zero point to {`{LONG | YES}`}, below zero
          to {`{SHORT | NO}`}. Agreement % is the magnitude of the net vote divided by total
          weight.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-panel p-4 shadow-card">
      <span className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</span>
      <span className="text-xl font-semibold text-text tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}
