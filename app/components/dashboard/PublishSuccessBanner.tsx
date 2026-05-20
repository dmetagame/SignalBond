"use client";

import { ArrowUpRight, BadgeCheck, CircleDollarSign, Hash, Trophy, X } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { shortHash } from "../../lib/dashboard-actions";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const pct = (value: number) => `+${value.toFixed(1)}`;

export default function PublishSuccessBanner() {
  const { publishSuccess, clearPublishSuccess } = useDashboard();
  if (!publishSuccess) return null;

  const txUrl = `https://testnet.arcscan.app/tx/${publishSuccess.txHash}`;
  const signalLabel =
    publishSuccess.signalId !== undefined
      ? `#${publishSuccess.signalId}`
      : publishSuccess.contractSignalCount !== undefined
        ? `#${publishSuccess.contractSignalCount}`
        : "Recorded";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-success/30 bg-panel shadow-card">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <BadgeCheck className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text">Signal published to Arc</h2>
              <span className="rounded-md bg-panel-muted px-2 py-0.5 font-mono text-[11px] text-muted">
                {signalLabel}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              {publishSuccess.agentName} staked {usd(publishSuccess.stakeUsdc)} on{" "}
              <span className="text-text">{publishSuccess.market}</span>. The contract state has
              refreshed and the new signal is now in the book.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <Metric
            icon={Hash}
            label="Contract signals"
            value={
              publishSuccess.contractSignalCount !== undefined
                ? String(publishSuccess.contractSignalCount)
                : "Synced"
            }
          />
          <Metric
            icon={CircleDollarSign}
            label="Stake delta"
            value={`+${usd(publishSuccess.stakeDeltaUsdc || publishSuccess.stakeUsdc)}`}
          />
          <Metric
            icon={Trophy}
            label="Rep. lift"
            value={pct(publishSuccess.reputationDelta)}
          />
          <a
            href={txUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[64px] flex-col justify-between rounded-xl border border-line-soft bg-panel-muted px-3 py-2 text-left hover:border-line"
          >
            <span className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-faint">
              Tx
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </span>
            <span className="font-mono text-xs font-semibold text-text">
              {shortHash(publishSuccess.txHash)}
            </span>
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={clearPublishSuccess}
        aria-label="Dismiss published signal"
        className="absolute right-3 top-3 rounded-lg p-1.5 text-faint hover:bg-panel-muted hover:text-muted"
      >
        <X className="size-4" strokeWidth={2} />
      </button>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[64px] flex-col justify-between rounded-xl border border-line-soft bg-panel-muted px-3 py-2">
      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-faint">
        <Icon className="size-3.5" strokeWidth={2} />
        {label}
      </span>
      <span className="font-mono text-xs font-semibold text-text">{value}</span>
    </div>
  );
}
