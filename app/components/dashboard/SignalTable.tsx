import { Gavel, MoreHorizontal } from "lucide-react";
import type { Agent, Signal } from "../../lib/types";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

type Status = "Active" | "Won" | "Lost";

function deriveStatus(signal: Signal): Status {
  if (signal.status === "active") return "Active";
  return signal.correct ? "Won" : "Lost";
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    Active: "bg-accent-soft text-accent",
    Won: "bg-success-soft text-success",
    Lost: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status]}`}
    >
      <span
        className={[
          "size-1.5 rounded-full",
          status === "Active"
            ? "bg-accent"
            : status === "Won"
              ? "bg-success"
              : "bg-danger",
        ].join(" ")}
      />
      {status}
    </span>
  );
}

export default function SignalTable({
  signals,
  agents,
  onSelect,
  onResolve,
  resolving = false,
  settlementLocked,
  settlementCountdown,
}: {
  signals: Signal[];
  agents: Agent[];
  onSelect?: (signal: Signal) => void;
  onResolve?: (signal: Signal) => void | Promise<void>;
  resolving?: boolean;
  settlementLocked?: (signal: Signal) => boolean;
  settlementCountdown?: (signal: Signal) => string;
}) {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Signal Book</h2>
          <p className="mt-1 text-xs text-muted">
            {signals.length} signal{signals.length === 1 ? "" : "s"} on record
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-faint">
              <th className="px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 text-left font-medium">Market</th>
              <th className="px-3 py-2 text-left font-medium">Agent</th>
              <th className="px-3 py-2 text-left font-medium">Side</th>
              <th className="px-3 py-2 text-right font-medium">Confidence</th>
              <th className="px-3 py-2 text-right font-medium">Stake</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
              {onResolve && <th className="px-3 py-2 text-right font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 && (
              <tr>
                <td
                  colSpan={onResolve ? 8 : 7}
                  className="rounded-xl border border-dashed border-line-soft bg-panel-muted/40 px-3 py-8 text-center text-sm text-faint"
                >
                  No signals yet
                </td>
              </tr>
            )}
            {signals.map((signal) => {
              const agent = agentMap.get(signal.agentId);
              const status = deriveStatus(signal);
              const locked = settlementLocked?.(signal) ?? false;
              const countdown = settlementCountdown?.(signal);
              return (
                <tr
                  key={signal.id}
                  onClick={() => onSelect?.(signal)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(signal);
                    }
                  }}
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  className={[
                    "text-sm text-text hover:bg-panel-muted/50",
                    onSelect ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-3 font-mono text-xs text-muted">{signal.id}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{signal.market}</div>
                    <div className="text-[11px] text-faint">{signal.venue}</div>
                  </td>
                  <td className="px-3 py-3">
                    {agent ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="flex size-6 items-center justify-center rounded-md text-[10px] font-semibold uppercase"
                          style={{
                            backgroundColor: `${agent.color}22`,
                            color: agent.color,
                            border: `1px solid ${agent.color}55`,
                          }}
                        >
                          {agent.handle.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{agent.name}</div>
                          <div className="truncate text-[11px] text-faint">{agent.desk}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-faint">Unknown</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md border border-line-soft bg-panel-muted px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-muted">
                      {signal.direction}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted">
                    {(signal.confidenceBps / 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {usd(signal.stakeUsdc)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <StatusPill status={status} />
                  </td>
                  {onResolve && (
                    <td className="px-3 py-3 text-right">
                      {status === "Active" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onResolve(signal);
                          }}
                          disabled={resolving || locked}
                          title={locked ? "Settlement unlocks after expiry" : undefined}
                          className="inline-flex items-center gap-1 rounded-md border border-line-soft bg-panel-muted px-2 py-1 text-[11px] font-semibold text-muted hover:border-line hover:text-text disabled:opacity-50"
                        >
                          <Gavel className="size-3" strokeWidth={2} />
                          {locked && countdown ? countdown : locked ? "Locked" : "Resolve"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-faint">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
