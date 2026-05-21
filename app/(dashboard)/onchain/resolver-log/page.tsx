"use client";

import { useDashboard } from "../../../components/dashboard/DashboardProvider";
import SectionHeader from "../../../components/dashboard/SectionHeader";
import { formatBps, formatUsdc } from "../../../lib/reputation";

export default function ResolverLogPage() {
  const { signals, agents } = useDashboard();
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const log = signals
    .filter((s) => s.status === "settled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Resolver log"
        subtitle="Chronological feed of every settlement — who, what, and the PnL stamp."
      />

      <section className="rounded-2xl border border-line bg-panel p-6 shadow-card">
        {log.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-soft bg-panel-muted/40 px-3 py-12 text-center text-sm text-faint">
            No resolutions on record. Run an agent cycle and resolve a signal to populate the log.
          </div>
        ) : (
          <ol className="relative space-y-4">
            <span
              aria-hidden
              className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-line-soft"
            />
            {log.map((signal) => {
              const agent = agentMap.get(signal.agentId);
              const won = signal.correct === true;
              return (
                <li key={signal.id} className="relative flex gap-4 pl-5">
                  <span
                    className={[
                      "absolute left-0 top-1.5 size-3.5 rounded-full ring-4 ring-panel",
                      won ? "bg-success" : "bg-danger",
                    ].join(" ")}
                  />
                  <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-text">{signal.market}</div>
                      <div className="text-xs text-muted">
                        {agent?.name ?? "Unknown"} · stake {formatUsdc(signal.stakeUsdc)} ·{" "}
                        <code className="font-mono">{signal.id}</code>
                      </div>
                    </div>
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
          </ol>
        )}
      </section>
    </div>
  );
}
