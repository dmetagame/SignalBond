"use client";

import { ArrowDownRight, ArrowUpRight, Equal, Star, Trash2 } from "lucide-react";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import { useFollowed, type FollowSnapshot } from "../../lib/follow";
import { calculateScore, formatBps, formatUsdc } from "../../lib/reputation";
import type { Agent } from "../../lib/types";

type Row = {
  agent: Agent;
  snap: FollowSnapshot;
  currentReputation: number;
  reputationDelta: number;
  resolvedDelta: number;
  correctDelta: number;
  stakeDelta: number;
  pnlBpsDelta: number;
  pinnedAgo: string;
};

function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function FollowedAgentsPage() {
  const { agents } = useDashboard();
  const { followed, unpin, clearAll } = useFollowed();

  const rows: Row[] = Object.entries(followed)
    .flatMap(([agentId, snap]) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return [];
      const currentReputation = calculateScore(agent).reputation;
      return [
        {
          agent,
          snap,
          currentReputation,
          reputationDelta: currentReputation - snap.reputation,
          resolvedDelta: agent.resolvedSignals - snap.resolvedSignals,
          correctDelta: agent.correctSignals - snap.correctSignals,
          stakeDelta: agent.stakedUsdc - snap.stakedUsdc,
          pnlBpsDelta: agent.cumulativePnlBps - snap.cumulativePnlBps,
          pinnedAgo: timeAgo(snap.pinnedAt),
        },
      ];
    })
    .sort(
      (a, b) =>
        new Date(b.snap.pinnedAt).getTime() - new Date(a.snap.pinnedAt).getTime(),
    );

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Followed Agents"
        subtitle="Track stake, resolved calls, and reputation deltas since you pinned each agent."
        actions={
          rows.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-muted hover:text-text"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Clear all
            </button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-soft bg-panel-muted/40 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Star className="size-6" strokeWidth={1.75} />
          </span>
          <h2 className="text-base font-semibold text-text">Nothing pinned yet</h2>
          <p className="max-w-md text-sm text-muted">
            Open the <span className="font-semibold text-text">Agents</span> page and click the
            star on any card to pin it here. SignalBond captures a snapshot of that agent&apos;s
            stats at pin-time so you can see how stake, resolved calls, and reputation move from
            that moment onward.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <FollowedCard key={row.agent.id} row={row} onUnpin={() => unpin(row.agent.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowedCard({ row, onUnpin }: { row: Row; onUnpin: () => void }) {
  const { agent, snap, currentReputation, reputationDelta, resolvedDelta, stakeDelta, pnlBpsDelta, pinnedAgo } =
    row;
  const winRate = agent.resolvedSignals === 0
    ? 0
    : Math.round((agent.correctSignals / agent.resolvedSignals) * 100);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5 shadow-card">
      <header className="flex items-start gap-3">
        <span
          className="flex size-10 items-center justify-center rounded-lg text-sm font-semibold uppercase"
          style={{
            backgroundColor: `${agent.color}22`,
            color: agent.color,
            border: `1px solid ${agent.color}55`,
          }}
        >
          {agent.handle.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text">{agent.name}</h3>
          <div className="truncate text-[11px] text-muted">
            {agent.desk} · pinned {pinnedAgo}
          </div>
        </div>
        <button
          type="button"
          onClick={onUnpin}
          aria-label={`Unpin ${agent.name}`}
          className="flex size-7 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft text-accent hover:bg-accent-strong hover:text-accent-foreground"
        >
          <Star className="size-3.5" strokeWidth={2.25} fill="currentColor" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <DeltaStat
          label="Reputation"
          value={currentReputation.toFixed(1)}
          deltaText={
            reputationDelta === 0
              ? "no change"
              : `${reputationDelta > 0 ? "+" : ""}${reputationDelta.toFixed(1)} since ${snap.reputation.toFixed(1)}`
          }
          direction={signDirection(reputationDelta)}
        />
        <DeltaStat
          label="Resolved"
          value={agent.resolvedSignals.toString()}
          deltaText={
            resolvedDelta === 0
              ? "unchanged"
              : `+${resolvedDelta} since pin`
          }
          direction={resolvedDelta > 0 ? "up" : "flat"}
        />
        <DeltaStat
          label="Stake"
          value={formatUsdc(agent.stakedUsdc)}
          deltaText={
            stakeDelta === 0
              ? "unchanged"
              : `${stakeDelta > 0 ? "+" : ""}${formatUsdc(stakeDelta)} since pin`
          }
          direction={signDirection(stakeDelta)}
        />
        <DeltaStat
          label="Cum PnL"
          value={formatBps(agent.cumulativePnlBps)}
          deltaText={
            pnlBpsDelta === 0
              ? "unchanged"
              : `${pnlBpsDelta > 0 ? "+" : ""}${(pnlBpsDelta / 100).toFixed(2)}% since pin`
          }
          direction={signDirection(pnlBpsDelta)}
        />
      </div>

      <div className="flex items-center justify-between border-t border-line-soft pt-3 text-[11px] text-muted">
        <span>Win rate {winRate}%</span>
        <span>{agent.followers.toLocaleString()} followers</span>
      </div>
    </article>
  );
}

function signDirection(value: number): "up" | "down" | "flat" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function DeltaStat({
  label,
  value,
  deltaText,
  direction,
}: {
  label: string;
  value: string;
  deltaText: string;
  direction: "up" | "down" | "flat";
}) {
  const color =
    direction === "up"
      ? "text-success"
      : direction === "down"
        ? "text-danger"
        : "text-muted";
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Equal;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line-soft bg-panel-muted/40 p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-faint">
        {label}
      </span>
      <span className="text-base font-semibold text-text tabular-nums">{value}</span>
      <span className={`inline-flex items-center gap-1 text-[11px] ${color}`}>
        <Icon className="size-3" strokeWidth={2} />
        {deltaText}
      </span>
    </div>
  );
}
