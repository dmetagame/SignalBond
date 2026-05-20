import { calculateScore, formatUsdc } from "./reputation";
import type { Agent, Signal } from "./types";

export type Kpi = {
  label: string;
  value: string;
  context: string;
};

export type KpiSet = {
  activeSignals: Kpi;
  totalStake: Kpi;
  topReputation: Kpi;
  resolvedCalls: Kpi;
};

export function computeKpis(agents: Agent[], signals: Signal[]): KpiSet {
  const active = signals.filter((s) => s.status === "active");
  const settled = signals.filter((s) => s.status === "settled");
  const totalStake = signals.reduce((sum, s) => sum + s.stakeUsdc, 0);

  const publishingAgentIds = new Set(active.map((s) => s.agentId));

  const ranked = agents
    .map((agent) => ({ agent, score: calculateScore(agent).reputation }))
    .sort((a, b) => b.score - a.score);
  const leader = ranked[0];
  const runnerUp = ranked[1];

  const aggregateCorrect = agents.reduce((sum, a) => sum + a.correctSignals, 0);
  const aggregateResolved = agents.reduce((sum, a) => sum + a.resolvedSignals, 0);
  const winRatePct =
    aggregateResolved === 0 ? 0 : Math.round((aggregateCorrect / aggregateResolved) * 100);

  return {
    activeSignals: {
      label: "Active Signals",
      value: active.length.toString(),
      context:
        publishingAgentIds.size === 0
          ? "No agents publishing"
          : `${publishingAgentIds.size} of ${agents.length} agents publishing`,
    },
    totalStake: {
      label: "Total Stake",
      value: formatUsdc(totalStake),
      context:
        signals.length === 0
          ? "No live stakes"
          : `Across ${signals.length} signal${signals.length === 1 ? "" : "s"}`,
    },
    topReputation: {
      label: "Top Reputation",
      value: leader ? leader.score.toFixed(1) : "—",
      context: leader
        ? runnerUp
          ? `${leader.agent.name} · +${(leader.score - runnerUp.score).toFixed(1)} over #2`
          : leader.agent.name
        : "No ranked agents",
    },
    resolvedCalls: {
      label: "Resolved Calls",
      value: settled.length.toString(),
      context:
        aggregateResolved === 0
          ? "No resolutions yet"
          : `${winRatePct}% aggregate win rate`,
    },
  };
}
