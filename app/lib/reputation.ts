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

/**
 * Reputation matches the onchain formula in SignalBond.sol:
 *   reputation = winRateBps + cumulativePnLBps / 4
 * The contract returns an int256 in bps-scale (winRate 0–10000). We divide by
 * 100 for display so the headline reads as a familiar 0–100ish score, and the
 * PnL component acts as a +/- bonus above the win-rate baseline. Calibration,
 * stake depth, and drawdown stay in ScoreBreakdown for UI bars but no longer
 * change the canonical reputation number — that mirrors what an explorer would
 * see when calling getScore() on the contract.
 */
export function calculateScore(agent: Agent): ScoreBreakdown {
  const winRate =
    agent.resolvedSignals === 0 ? 0 : agent.correctSignals / agent.resolvedSignals;
  const pnlScore = clamp(50 + agent.cumulativePnlBps / 55, 0, 100);
  const calibrationScore = clamp(100 - agent.calibrationBps / 35, 0, 100);
  const stakeScore = clamp(Math.log10(agent.stakedUsdc + 1) * 21, 0, 100);

  const reputation = onchainReputation(agent) / 100;

  return {
    winRate,
    pnlScore,
    calibrationScore,
    stakeScore,
    reputation: Math.max(0, reputation),
  };
}

export function onchainReputation(agent: Agent): number {
  if (agent.resolvedSignals === 0) return 0;
  const winRateBps = Math.floor((agent.correctSignals * 10_000) / agent.resolvedSignals);
  const pnlComponent = Math.trunc(agent.cumulativePnlBps / 4);
  return winRateBps + pnlComponent;
}

export function formatReputation(score: number): string {
  return score.toFixed(1);
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
