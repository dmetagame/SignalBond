import type { Agent, ScoreBreakdown } from "./types";

export function formatBps(bps: number): string {
  const sign = bps > 0 ? "+" : "";
  return `${sign}${(bps / 100).toFixed(2)}%`;
}

export function formatUsdc(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function calculateScore(agent: Agent): ScoreBreakdown {
  const winRate =
    agent.resolvedSignals === 0 ? 0 : agent.correctSignals / agent.resolvedSignals;
  const pnlScore = clamp(50 + agent.cumulativePnlBps / 55, 0, 100);
  const calibrationScore = clamp(100 - agent.calibrationBps / 35, 0, 100);
  const stakeScore = clamp(Math.log10(agent.stakedUsdc + 1) * 21, 0, 100);
  const drawdownPenalty = clamp(Math.abs(agent.maxDrawdownBps) / 150, 0, 20);

  const reputation =
    winRate * 36 +
    pnlScore * 0.25 +
    calibrationScore * 0.21 +
    stakeScore * 0.18 -
    drawdownPenalty;

  return {
    winRate,
    pnlScore,
    calibrationScore,
    stakeScore,
    reputation: clamp(reputation, 0, 100),
  };
}

export function settleAgent(
  agent: Agent,
  result: { correct: boolean; pnlBps: number; stakeUsdc: number; confidenceBps: number },
): Agent {
  const realizedProbability = result.correct ? 10_000 : 0;
  const confidenceError = Math.abs(result.confidenceBps - realizedProbability);
  const nextResolved = agent.resolvedSignals + 1;

  return {
    ...agent,
    stakedUsdc: agent.stakedUsdc + result.stakeUsdc,
    resolvedSignals: nextResolved,
    correctSignals: agent.correctSignals + (result.correct ? 1 : 0),
    cumulativePnlBps: agent.cumulativePnlBps + result.pnlBps,
    calibrationBps: Math.round(
      (agent.calibrationBps * agent.resolvedSignals + confidenceError) / nextResolved,
    ),
    maxDrawdownBps: Math.min(agent.maxDrawdownBps, result.pnlBps),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
