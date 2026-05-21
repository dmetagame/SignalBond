"use client";

import { ExternalLink, Gavel, ShieldCheck } from "lucide-react";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import { shortHash } from "../../lib/dashboard-actions";
import { formatBps, formatUsdc } from "../../lib/reputation";

export default function SettlementPage() {
  const {
    signals,
    agents,
    resolverAddress,
    ownerAddress,
    contractSignalCount,
    lastOnchainTx,
  } = useDashboard();

  const settled = signals
    .filter((s) => s.status === "settled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Settlement"
        subtitle="Resolved calls, resolver wallet, and the contract lane."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          icon={<Gavel className="size-4" strokeWidth={1.75} />}
          label="Resolved signals"
          value={settled.length.toString()}
          hint={`${contractSignalCount ?? signals.length} on contract`}
        />
        <InfoCard
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          label="Resolver"
          value={resolverAddress ? shortHash(resolverAddress) : "—"}
          mono
        />
        <InfoCard
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          label="Owner"
          value={ownerAddress ? shortHash(ownerAddress) : "—"}
          mono
        />
        <InfoCard
          icon={<ExternalLink className="size-4" strokeWidth={1.75} />}
          label="Last tx"
          value={lastOnchainTx ? shortHash(lastOnchainTx) : "None this session"}
          mono
        />
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
        <h2 className="text-base font-semibold text-text">Recent resolutions</h2>
        {settled.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-soft bg-panel-muted/40 px-3 py-8 text-center text-sm text-faint">
            No signals resolved yet — run a Quick Demo or resolve from the Signal Book.
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {settled.map((signal) => {
              const agent = agentMap.get(signal.agentId);
              const won = signal.correct === true;
              return (
                <li
                  key={signal.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    className={[
                      "size-2 rounded-full",
                      won ? "bg-success" : "bg-danger",
                    ].join(" ")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{signal.market}</div>
                    <div className="truncate text-xs text-muted">
                      {agent?.name ?? "Unknown"} · {signal.direction} · stake{" "}
                      {formatUsdc(signal.stakeUsdc)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={[
                        "text-sm font-semibold tabular-nums",
                        won ? "text-success" : "text-danger",
                      ].join(" ")}
                    >
                      {won ? "Won" : "Lost"} {formatBps(signal.pnlBps ?? 0)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  hint,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
          {label}
        </span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-panel-muted text-muted">
          {icon}
        </span>
      </div>
      <span
        className={`text-lg font-semibold text-text ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
