import type { Agent, Signal } from "./types";

export type PerformancePoint = {
  date: string;
  value: number;
};

export type PerformanceSnapshot = {
  headlinePnlUsd: number;
  weightedReturnBps: number;
  series: PerformancePoint[];
  realizedDeltaUsd: number;
};

export function computePerformance(
  agents: Agent[],
  signals: Signal[],
): PerformanceSnapshot {
  const totalStake = agents.reduce((sum, a) => sum + a.stakedUsdc, 0);
  const weightedPnlUsd = agents.reduce(
    (sum, a) => sum + (a.stakedUsdc * a.cumulativePnlBps) / 10000,
    0,
  );
  const weightedReturnBps =
    totalStake === 0 ? 0 : Math.round((weightedPnlUsd / totalStake) * 10000);

  const sortedSignals = [...signals].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const series: PerformancePoint[] = [];
  let runningPnl = 0;
  for (const signal of sortedSignals) {
    if (signal.status === "settled" && typeof signal.pnlBps === "number") {
      runningPnl += (signal.stakeUsdc * signal.pnlBps) / 10000;
    }
    series.push({
      date: signal.createdAt.slice(0, 10),
      value: round2(runningPnl),
    });
  }

  if (series.length > 0 && series.length < 8) {
    const earliestMs = new Date(series[0].date).getTime();
    const baselineDate = new Date(earliestMs - 86_400_000).toISOString().slice(0, 10);
    series.unshift({ date: baselineDate, value: 0 });
  }

  const realizedDeltaUsd =
    series.length === 0 ? 0 : round2(series[series.length - 1].value - series[0].value);

  return {
    headlinePnlUsd: round2(weightedPnlUsd),
    weightedReturnBps,
    series,
    realizedDeltaUsd,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
