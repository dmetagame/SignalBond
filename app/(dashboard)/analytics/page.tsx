"use client";

import { useDashboard } from "../../components/dashboard/DashboardProvider";
import Gauge from "../../components/dashboard/Gauge";
import LineChartCard from "../../components/dashboard/LineChartCard";
import SectionHeader from "../../components/dashboard/SectionHeader";
import SegmentedBreakdown from "../../components/dashboard/SegmentedBreakdown";
import WeekdayBars from "../../components/dashboard/WeekdayBars";
import { computeComposition } from "../../lib/composition";
import { computePerformance } from "../../lib/performance";
import { computeWeekdayActivity } from "../../lib/weekday";

export default function AnalyticsPage() {
  const { agents, signals } = useDashboard();
  const performance = computePerformance(agents, signals);
  const composition = computeComposition(agents);
  const weekday = computeWeekdayActivity(signals);
  const aggregateCorrect = agents.reduce((sum, a) => sum + a.correctSignals, 0);
  const aggregateResolved = agents.reduce((sum, a) => sum + a.resolvedSignals, 0);
  const winRatePct =
    aggregateResolved === 0 ? 0 : (aggregateCorrect / aggregateResolved) * 100;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Analytics"
        subtitle="Aggregate performance, composition, and cadence across all agents."
      />

      <LineChartCard
        title="Stake-Weighted Performance"
        headlineUsd={performance.headlinePnlUsd}
        returnBps={performance.weightedReturnBps}
        series={performance.series}
        realizedDeltaUsd={performance.realizedDeltaUsd}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SegmentedBreakdown
          title="Agent Composition"
          segments={composition.segments}
          totalAgents={composition.totalAgents}
          totalStake={composition.totalStake}
        />
        <WeekdayBars
          title="Most Active Day"
          buckets={weekday.buckets}
          peakIndex={weekday.peakIndex}
          peakCount={weekday.peakCount}
        />
      </div>

      <Gauge
        title="Win Rate"
        percent={winRatePct}
        target={70}
        resolvedCount={aggregateResolved}
      />
    </div>
  );
}
