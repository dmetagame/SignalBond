"use client";

import {
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  FileKey2,
  Gavel,
  Hash,
  Landmark,
  ShieldCheck,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usdcAddress, signalBondAddress } from "../../lib/contract";
import { shortHash } from "../../lib/dashboard-actions";
import { arcAddressUrl, arcTxUrl } from "../../lib/explorer";
import { calculateScore, formatBps, formatUsdc } from "../../lib/reputation";
import type { Agent, Signal } from "../../lib/types";
import { useDashboard } from "./DashboardProvider";

export default function SignalDetailDrawer() {
  const {
    agents,
    selectedSignal,
    closeSignalDetails,
    resolveSignal,
    busy,
    isOnchainData,
  } = useDashboard();
  const nowMs = useNowMs(Boolean(selectedSignal));

  useEffect(() => {
    if (!selectedSignal) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSignalDetails();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSignal, closeSignalDetails]);

  if (!selectedSignal) return null;

  const agent = agents.find((item) => item.id === selectedSignal.agentId);
  const settlementLocked =
    isOnchainData &&
    selectedSignal.status === "active" &&
    new Date(selectedSignal.expiresAt).getTime() > nowMs;
  const canResolve = selectedSignal.status === "active" && !busy.onchain && !settlementLocked;
  const unlockMs = new Date(selectedSignal.expiresAt).getTime() - nowMs;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeSignalDetails} />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-panel shadow-2xl">
        <header className="border-b border-line-soft px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-panel-muted px-2 py-0.5 font-mono text-[11px] text-muted">
                  {selectedSignal.onchainId ? `Signal #${selectedSignal.onchainId}` : selectedSignal.id}
                </span>
                <StatusBadge signal={selectedSignal} />
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-text">
                {selectedSignal.market}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {agent?.name ?? selectedSignal.agentId} · {selectedSignal.venue}
              </p>
            </div>
            <button
              type="button"
              onClick={closeSignalDetails}
              aria-label="Close signal details"
              className="rounded-lg p-1.5 text-faint hover:bg-panel-muted hover:text-muted"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Metric icon={Target} label="Side" value={selectedSignal.direction} />
            <Metric
              icon={ShieldCheck}
              label="Confidence"
              value={`${(selectedSignal.confidenceBps / 100).toFixed(0)}%`}
            />
            <Metric
              icon={CircleDollarSign}
              label="Stake"
              value={formatUsdc(selectedSignal.stakeUsdc)}
            />
            <Metric
              icon={CalendarClock}
              label={selectedSignal.status === "active" ? "Expires" : "Resolved"}
              value={new Date(selectedSignal.expiresAt).toLocaleDateString()}
            />
          </div>

          <section className="mt-6">
            <SectionTitle title="Arc Proof" />
            <div className="mt-3 divide-y divide-line-soft rounded-2xl border border-line-soft">
              <ProofLink
                label="Publish transaction"
                value={shortHash(selectedSignal.txHash)}
                href={arcTxUrl(selectedSignal.txHash)}
              />
              {signalBondAddress && (
                <ProofLink
                  label="SignalBond contract"
                  value={shortHash(signalBondAddress)}
                  href={arcAddressUrl(signalBondAddress)}
                />
              )}
              {usdcAddress && (
                <ProofLink
                  label="Stake token"
                  value={shortHash(usdcAddress)}
                  href={arcAddressUrl(usdcAddress)}
                />
              )}
              {selectedSignal.publisher && (
                <ProofLink
                  label="Publisher"
                  value={shortHash(selectedSignal.publisher)}
                  href={arcAddressUrl(selectedSignal.publisher)}
                />
              )}
              <ProofValue label="Source commitment" value={shortHash(selectedSignal.sourceHash)} />
            </div>
          </section>

          {agent && (
            <section className="mt-6">
              <SectionTitle title="Reputation Impact" />
              <SettlementImpact agent={agent} signal={selectedSignal} />
            </section>
          )}

          <section className="mt-6">
            <SectionTitle title="Agent Reasoning" />
            <p className="mt-3 text-sm leading-relaxed text-muted">{selectedSignal.reasoning}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSignal.sources.map((source) => (
                <span
                  key={source}
                  className="rounded-md border border-line-soft bg-panel-muted px-2 py-0.5 text-[11px] text-muted"
                >
                  {source}
                </span>
              ))}
            </div>
          </section>
        </div>

        <footer className="border-t border-line-soft px-6 py-4">
          {settlementLocked ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-panel-muted px-3 py-2.5">
              <div>
                <div className="text-xs font-semibold text-text">Settlement countdown</div>
                <p className="mt-0.5 text-xs text-muted">
                  Unlocks after {new Date(selectedSignal.expiresAt).toLocaleString()}.
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-accent">
                {formatCountdown(unlockMs)}
              </span>
            </div>
          ) : selectedSignal.status === "active" ? (
            <button
              type="button"
              onClick={() => resolveSignal(selectedSignal)}
              disabled={!canResolve}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
            >
              <Gavel className="size-4" strokeWidth={2} />
              {busy.onchain ? "Settling…" : "Settle Signal"}
            </button>
          ) : (
            <p className="text-xs text-muted">This signal is settled and included in agent scoring.</p>
          )}
        </footer>
      </aside>
    </div>
  );
}

function useNowMs(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return nowMs;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ready";

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function StatusBadge({ signal }: { signal: Signal }) {
  const label = signal.status === "active" ? "Active" : signal.correct ? "Won" : "Lost";
  const style =
    signal.status === "active"
      ? "bg-accent-soft text-accent"
      : signal.correct
        ? "bg-success-soft text-success"
        : "bg-danger-soft text-danger";

  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${style}`}>{label}</span>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-panel-muted p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-faint">
        <Icon className="size-3.5" strokeWidth={2} />
        {label}
      </div>
      <div className="mt-2 font-mono text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold uppercase text-faint">{title}</h3>;
}

function ProofLink({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-panel-muted"
    >
      <span className="text-muted">{label}</span>
      <span className="inline-flex items-center gap-2 font-mono text-xs text-text">
        {value}
        <ArrowUpRight className="size-3.5 text-faint" strokeWidth={2} />
      </span>
    </a>
  );
}

function ProofValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="inline-flex items-center gap-2 font-mono text-xs text-text">
        <FileKey2 className="size-3.5 text-faint" strokeWidth={2} />
        {value}
      </span>
    </div>
  );
}

function SettlementImpact({ agent, signal }: { agent: Agent; signal: Signal }) {
  const score = calculateScore(agent).reputation;

  if (signal.status === "settled") {
    const calibrationError = Math.abs(signal.confidenceBps - (signal.correct ? 10_000 : 0));
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric icon={Gavel} label="Outcome" value={signal.correct ? "Correct" : "Incorrect"} />
        <Metric icon={Landmark} label="Realized PnL" value={formatBps(signal.pnlBps ?? 0)} />
        <Metric
          icon={ShieldCheck}
          label="Calibration error"
          value={`${(calibrationError / 100).toFixed(0)}%`}
        />
        <Metric icon={Hash} label="Agent score" value={score.toFixed(1)} />
      </div>
    );
  }

  const correctProjection = projectSettlement(agent, signal, true);
  const wrongProjection = projectSettlement(agent, signal, false);

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ProjectionCard title="If correct" projection={correctProjection} />
      <ProjectionCard title="If wrong" projection={wrongProjection} />
    </div>
  );
}

function ProjectionCard({
  title,
  projection,
}: {
  title: string;
  projection: { pnlBps: number; scoreDelta: number; scoreAfter: number };
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-panel-muted p-3">
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase text-faint">PnL</div>
          <div className="mt-1 font-mono text-xs font-semibold text-text">
            {formatBps(projection.pnlBps)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-faint">Score</div>
          <div className="mt-1 font-mono text-xs font-semibold text-text">
            {projection.scoreAfter.toFixed(1)} ({signedNumber(projection.scoreDelta)})
          </div>
        </div>
      </div>
    </div>
  );
}

function projectSettlement(agent: Agent, signal: Signal, correct: boolean) {
  const scoreBefore = calculateScore(agent).reputation;
  const pnlBps = estimatePnlBps(signal, correct);
  const nextResolved = agent.resolvedSignals + 1;
  const realizedProbability = correct ? 10_000 : 0;
  const projectedAgent: Agent = {
    ...agent,
    resolvedSignals: nextResolved,
    correctSignals: agent.correctSignals + (correct ? 1 : 0),
    cumulativePnlBps: agent.cumulativePnlBps + pnlBps,
    calibrationBps: Math.round(
      (agent.calibrationBps * agent.resolvedSignals +
        Math.abs(signal.confidenceBps - realizedProbability)) /
        nextResolved,
    ),
    maxDrawdownBps: Math.min(agent.maxDrawdownBps, pnlBps),
  };
  const scoreAfter = calculateScore(projectedAgent).reputation;

  return {
    pnlBps,
    scoreAfter,
    scoreDelta: scoreAfter - scoreBefore,
  };
}

function estimatePnlBps(signal: Signal, correct: boolean): number {
  const directionMultiplier = signal.direction === "SHORT" || signal.direction === "NO" ? -1 : 1;
  const rawMove =
    signal.entryPrice === 0
      ? 0
      : ((signal.targetPrice - signal.entryPrice) / signal.entryPrice) *
        10_000 *
        directionMultiplier;
  return Math.round(correct ? Math.abs(rawMove) : -Math.abs(rawMove) * 0.7);
}

function signedNumber(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}
