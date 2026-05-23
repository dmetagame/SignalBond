"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  Gavel,
  LineChart,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { shortHash } from "../../lib/dashboard-actions";
import { arcTxUrl } from "../../lib/explorer";
import { formatBps, formatUsdc } from "../../lib/reputation";

export default function SettlementSuccessBanner() {
  const { settlementSuccess, clearSettlementSuccess } = useDashboard();
  if (!settlementSuccess) return null;

  const scoreDelta = settlementSuccess.reputationAfter - settlementSuccess.reputationBefore;
  const winRateDelta = settlementSuccess.winRateAfter - settlementSuccess.winRateBefore;
  const walletBalanceDelta = settlementSuccess.walletBalanceDeltaUsdc;
  const hasWalletBalanceDelta = walletBalanceDelta !== undefined;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-panel-muted text-text">
            <Gavel className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text">Signal settled on Arc</h2>
              <span
                className={[
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  settlementSuccess.correct
                    ? "bg-success-soft text-success"
                    : "bg-danger-soft text-danger",
                ].join(" ")}
              >
                {settlementSuccess.correct ? "Correct" : "Incorrect"}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              {settlementSuccess.agentName} settled{" "}
              <span className="text-text">{settlementSuccess.market}</span> with{" "}
              {formatBps(settlementSuccess.pnlBps)} realized PnL on a{" "}
              {formatUsdc(settlementSuccess.stakeUsdc)} stake.{" "}
              {settlementSuccess.correct
                ? "The publisher balance increases when the escrowed stake is returned."
                : "Losses do not subtract again at settlement; the stake left the wallet at publish and is now in the slashed reserve."}
            </p>
          </div>
        </div>

        <div
          className={[
            "grid grid-cols-2 gap-2",
            hasWalletBalanceDelta
              ? "sm:grid-cols-5 lg:min-w-[640px]"
              : "sm:grid-cols-4 lg:min-w-[520px]",
          ].join(" ")}
        >
          <Metric
            icon={BadgeCheck}
            label="Resolved"
            value={`+${settlementSuccess.resolvedDelta}`}
          />
          <Metric
            icon={LineChart}
            label="Win rate"
            value={signedPercent(winRateDelta)}
          />
          <Metric icon={Trophy} label="Reputation" value={signedNumber(scoreDelta)} />
          {hasWalletBalanceDelta && (
            <Metric
              icon={CircleDollarSign}
              label="Wallet"
              value={signedUsdc(walletBalanceDelta)}
            />
          )}
          <a
            href={arcTxUrl(settlementSuccess.txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[64px] flex-col justify-between rounded-xl border border-line-soft bg-panel-muted px-3 py-2 text-left hover:border-line"
          >
            <span className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase text-faint">
              Settlement tx
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </span>
            <span className="font-mono text-xs font-semibold text-text">
              {shortHash(settlementSuccess.txHash)}
            </span>
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={clearSettlementSuccess}
        aria-label="Dismiss settled signal"
        className="absolute right-3 top-3 rounded-lg p-1.5 text-faint hover:bg-panel-muted hover:text-muted"
      >
        <X className="size-4" strokeWidth={2} />
      </button>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-h-[64px] flex-col justify-between rounded-xl border border-line-soft bg-panel-muted px-3 py-2">
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-faint">
        <Icon className="size-3.5" strokeWidth={2} />
        {label}
      </span>
      <span className="font-mono text-xs font-semibold text-text">{value}</span>
    </div>
  );
}

function signedNumber(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

function signedPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function signedUsdc(value: number): string {
  if (value === 0) return formatUsdc(0);
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatUsdc(value)}`;
}
