"use client";

import { Activity, AlertTriangle, BadgeCheck, CalendarRange, CircleDollarSign, Play, Plus, RefreshCw, Trophy, X } from "lucide-react";
import AgentAssistant from "./AgentAssistant";
import DashboardLayout from "./DashboardLayout";
import DashboardProvider, { useDashboard } from "./DashboardProvider";
import Gauge from "./Gauge";
import KpiCard from "./KpiCard";
import LineChartCard from "./LineChartCard";
import ProposalModal from "./ProposalModal";
import SectionHeader from "./SectionHeader";
import SegmentedBreakdown from "./SegmentedBreakdown";
import SignalTable from "./SignalTable";
import WeekdayBars from "./WeekdayBars";
import type { ChainState } from "../../lib/chain-state";
import { computeComposition } from "../../lib/composition";
import { computeKpis } from "../../lib/kpis";
import { computePerformance } from "../../lib/performance";
import { computeWeekdayActivity } from "../../lib/weekday";

export default function DashboardShell({
  initialChainState,
}: {
  initialChainState?: ChainState;
}) {
  return (
    <DashboardProvider initialChainState={initialChainState}>
      <ShellContent />
    </DashboardProvider>
  );
}

function ShellContent() {
  const {
    agents,
    signals,
    walletError,
    syncState,
    busy,
    runAgentCycle,
    resolveSignal,
    refreshChainState,
    clearError,
  } = useDashboard();

  const kpis = computeKpis(agents, signals);
  const performance = computePerformance(agents, signals);
  const composition = computeComposition(agents);
  const weekday = computeWeekdayActivity(signals);

  const aggregateCorrect = agents.reduce((sum, a) => sum + a.correctSignals, 0);
  const aggregateResolved = agents.reduce((sum, a) => sum + a.resolvedSignals, 0);
  const winRatePct =
    aggregateResolved === 0 ? 0 : (aggregateCorrect / aggregateResolved) * 100;

  const latestSignal = [...signals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  const latestAgent = latestSignal
    ? agents.find((a) => a.id === latestSignal.agentId)
    : undefined;

  const cyclePending = busy.scan || busy.onchain;
  const cycleLabel = busy.scan
    ? "Scanning…"
    : busy.onchain
      ? "Publishing…"
      : "Run Agent Cycle";

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        {walletError && <ErrorBanner message={walletError} onDismiss={clearError} />}

        <SectionHeader
          title="Dashboard"
          subtitle="Stake-weighted reputation across active market agents."
          actions={
            <>
              <button
                type="button"
                className="hidden items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-muted hover:text-text sm:inline-flex"
              >
                <CalendarRange className="size-4" strokeWidth={1.75} />
                Last 30 days
              </button>
              <button
                type="button"
                onClick={refreshChainState}
                disabled={syncState === "syncing"}
                className="hidden items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-muted hover:text-text md:inline-flex disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-4 ${syncState === "syncing" ? "animate-spin" : ""}`}
                  strokeWidth={1.75}
                />
                {syncState === "syncing" ? "Syncing" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={runAgentCycle}
                disabled={cyclePending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
              >
                <Play className="size-4" strokeWidth={2} />
                {cycleLabel}
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={kpis.activeSignals.label}
            value={kpis.activeSignals.value}
            icon={Activity}
            context={kpis.activeSignals.context}
          />
          <KpiCard
            label={kpis.totalStake.label}
            value={kpis.totalStake.value}
            icon={CircleDollarSign}
            context={kpis.totalStake.context}
          />
          <KpiCard
            label={kpis.topReputation.label}
            value={kpis.topReputation.value}
            icon={Trophy}
            context={kpis.topReputation.context}
          />
          <KpiCard
            label={kpis.resolvedCalls.label}
            value={kpis.resolvedCalls.value}
            icon={BadgeCheck}
            context={kpis.resolvedCalls.context}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <LineChartCard
              title="Stake-Weighted Performance"
              headlineUsd={performance.headlinePnlUsd}
              returnBps={performance.weightedReturnBps}
              series={performance.series}
              realizedDeltaUsd={performance.realizedDeltaUsd}
            />
            <SegmentedBreakdown
              title="Agent Composition"
              segments={composition.segments}
              totalAgents={composition.totalAgents}
              totalStake={composition.totalStake}
            />
          </div>

          <div className="flex flex-col gap-6">
            <WeekdayBars
              title="Most Active Day"
              buckets={weekday.buckets}
              peakIndex={weekday.peakIndex}
              peakCount={weekday.peakCount}
            />
            <Gauge
              title="Win Rate"
              percent={winRatePct}
              target={70}
              resolvedCount={aggregateResolved}
            />
            <AgentAssistant signal={latestSignal} agent={latestAgent} />
          </div>
        </div>

        <SignalTable
          signals={signals}
          agents={agents}
          onResolve={resolveSignal}
          resolving={busy.onchain}
        />
      </div>
      <ProposalModal />
    </DashboardLayout>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded p-0.5 hover:bg-danger/10"
      >
        <X className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}
