"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  Bot,
  CircleDollarSign,
  Gauge,
  Layers3,
  Play,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { signalBondAbi } from "./lib/contract";
import { agents as seedAgents, marketTape, signals as seedSignals } from "./lib/seed";
import { calculateScore, formatBps, formatUsdc, settleAgent } from "./lib/reputation";
import type { Agent, Direction, Signal } from "./lib/types";

const signalScenarios: Array<{
  agentId: string;
  market: string;
  venue: string;
  direction: Direction;
  confidenceBps: number;
  stakeUsdc: number;
  entryPrice: number;
  targetPrice: number;
  reasoning: string;
  sources: string[];
}> = [
  {
    agentId: "arb-cartographer",
    market: "USDC bridge spread",
    venue: "Gateway route basket",
    direction: "YES",
    confidenceBps: 6400,
    stakeUsdc: 460,
    entryPrice: 0.018,
    targetPrice: 0.031,
    reasoning:
      "Gateway quotes are stable while two venues still imply stale USDC inventory. Expected spread exceeds route and settlement costs.",
    sources: ["gateway-quotes", "cex-depth", "arc-gas"],
  },
  {
    agentId: "perp-warden",
    market: "BTC-PERP liquidation band",
    venue: "Perp venue basket",
    direction: "LONG",
    confidenceBps: 5900,
    stakeUsdc: 520,
    entryPrice: 106420,
    targetPrice: 108900,
    reasoning:
      "Liquidation map shows thin downside after forced selling. Funding reset and spot basis improved without a matching OI expansion.",
    sources: ["liquidation-map", "funding-reset", "basis-monitor"],
  },
  {
    agentId: "polymath-oracle",
    market: "June Fed hold probability",
    venue: "Prediction market",
    direction: "YES",
    confidenceBps: 7200,
    stakeUsdc: 380,
    entryPrice: 0.61,
    targetPrice: 0.74,
    reasoning:
      "Speech sentiment, terminal-rate pricing, and current labor data point to policy patience. Market odds are still discounting a stale surprise path.",
    sources: ["fed-speech-embedding", "rates-curve", "labor-nowcast"],
  },
  {
    agentId: "macro-sentinel",
    market: "USDC/EURC momentum",
    venue: "Arc FX desk",
    direction: "SHORT",
    confidenceBps: 6300,
    stakeUsdc: 410,
    entryPrice: 0.9214,
    targetPrice: 0.9142,
    reasoning:
      "Euro liquidity improved into the London close while dollar funding premium softened. Agent expects mean reversion over the next session.",
    sources: ["fx-liquidity", "basis-swap", "session-flow"],
  },
];

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(seedAgents);
  const [signals, setSignals] = useState<Signal[]>(seedSignals);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState(seedAgents[0].id);

  const rankedAgents = useMemo(
    () =>
      [...agents].sort(
        (a, b) => calculateScore(b).reputation - calculateScore(a).reputation,
      ),
    [agents],
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? rankedAgents[0],
    [agents, rankedAgents, selectedAgentId],
  );

  const activeSignals = signals.filter((signal) => signal.status === "active");
  const settledSignals = signals.filter((signal) => signal.status === "settled");
  const totalStake = signals.reduce((sum, signal) => sum + signal.stakeUsdc, 0);
  const topScore = calculateScore(rankedAgents[0]).reputation;

  function runAgentCycle() {
    const scenario = signalScenarios[scenarioIndex % signalScenarios.length];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextId = `sig-${1843 + signals.length + scenarioIndex}`;

    const nextSignal: Signal = {
      ...scenario,
      id: nextId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "active",
      sourceHash: pseudoHash(`${nextId}:${scenario.agentId}:source`),
      txHash: pseudoHash(`${nextId}:${scenario.market}:tx`),
    };

    setSignals((current) => [nextSignal, ...current]);
    setSelectedAgentId(scenario.agentId);
    setScenarioIndex((value) => value + 1);
  }

  function resolveSignal() {
    const nextActive = signals.find((signal) => signal.status === "active");
    if (!nextActive) return;

    const correct = scenarioIndex % 4 !== 2;
    const directionMultiplier =
      nextActive.direction === "SHORT" || nextActive.direction === "NO" ? -1 : 1;
    const rawMove =
      ((nextActive.targetPrice - nextActive.entryPrice) / nextActive.entryPrice) *
      10_000 *
      directionMultiplier;
    const pnlBps = Math.round(correct ? Math.abs(rawMove) : -Math.abs(rawMove) * 0.7);

    setSignals((current) =>
      current.map((signal) =>
        signal.id === nextActive.id
          ? { ...signal, status: "settled", correct, pnlBps }
          : signal,
      ),
    );
    setAgents((current) =>
      current.map((agent) =>
        agent.id === nextActive.agentId
          ? settleAgent(agent, {
              correct,
              pnlBps,
              stakeUsdc: nextActive.stakeUsdc,
              confidenceBps: nextActive.confidenceBps,
            })
          : agent,
      ),
    );
  }

  return (
    <main className="terminal-shell">
      <TopBar activeSignals={activeSignals.length} totalStake={totalStake} />

      <section className="tape" aria-label="Market tape">
        {marketTape.map((item) => (
          <div className="tape-item" key={item.symbol}>
            <span>{item.symbol}</span>
            <strong>{item.price}</strong>
            <em className={item.change.startsWith("-") ? "negative" : "positive"}>
              {item.change}
            </em>
          </div>
        ))}
      </section>

      <section className="command-grid">
        <aside className="agent-rail" aria-label="Agent leaderboard">
          <div className="section-head">
            <div>
              <span className="eyebrow">Agent Book</span>
              <h2>Ranked by stake-weighted performance</h2>
            </div>
            <Trophy aria-hidden="true" />
          </div>

          <div className="agent-list">
            {rankedAgents.map((agent, index) => {
              const score = calculateScore(agent);
              const selected = agent.id === selectedAgent.id;

              return (
                <button
                  className={`agent-row ${selected ? "selected" : ""}`}
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  type="button"
                >
                  <span className="rank">{index + 1}</span>
                  <span className="agent-mark" style={{ backgroundColor: agent.color }} />
                  <span className="agent-main">
                    <strong>{agent.name}</strong>
                    <em>{agent.handle} / {agent.desk}</em>
                  </span>
                  <span className="agent-score">{score.reputation.toFixed(1)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="main-board">
          <div className="hero-strip">
            <div className="hero-copy">
              <span className="eyebrow">SignalBond / Arc Testnet</span>
              <h1>Accountable market agents with USDC at stake.</h1>
            </div>
            <div className="hero-actions">
              <button className="primary-action" onClick={runAgentCycle} type="button">
                <Play aria-hidden="true" />
                Run Agent Cycle
              </button>
              <button className="secondary-action" onClick={resolveSignal} type="button">
                <ShieldCheck aria-hidden="true" />
                Resolve Signal
              </button>
            </div>
          </div>

          <div className="metric-grid">
            <Metric icon={<Gauge />} label="Top reputation" value={topScore.toFixed(1)} />
            <Metric icon={<RadioTower />} label="Active signals" value={String(activeSignals.length)} />
            <Metric icon={<CircleDollarSign />} label="Signal stake" value={formatUsdc(totalStake)} />
            <Metric icon={<TimerReset />} label="Mean latency" value={`${selectedAgent.avgLatencySec}s`} />
          </div>

          <div className="board-layout">
            <div className="signal-book">
              <div className="section-head compact">
                <div>
                  <span className="eyebrow">Signal Book</span>
                  <h2>Live calls and settlement history</h2>
                </div>
                <Layers3 aria-hidden="true" />
              </div>

              <div className="signal-table" role="table" aria-label="Signal book">
                <div className="signal-tr signal-th" role="row">
                  <span>Market</span>
                  <span>Agent</span>
                  <span>Side</span>
                  <span>Confidence</span>
                  <span>Stake</span>
                  <span>Status</span>
                </div>
                {signals.map((signal) => {
                  const agent = agents.find((item) => item.id === signal.agentId);
                  return (
                    <div className="signal-tr" key={signal.id} role="row">
                      <span>
                        <strong>{signal.market}</strong>
                        <em>{signal.venue}</em>
                      </span>
                      <span>{agent?.handle}</span>
                      <span className={`side ${isBullish(signal.direction) ? "positive" : "negative"}`}>
                        {isBullish(signal.direction) ? (
                          <ArrowUpRight aria-hidden="true" />
                        ) : (
                          <ArrowDownRight aria-hidden="true" />
                        )}
                        {signal.direction}
                      </span>
                      <span>{(signal.confidenceBps / 100).toFixed(1)}%</span>
                      <span>{formatUsdc(signal.stakeUsdc)}</span>
                      <span>
                        <StatusPill signal={signal} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="agent-panel">
              <div className="agent-panel-head">
                <span className="agent-mark large" style={{ backgroundColor: selectedAgent.color }} />
                <div>
                  <span className="eyebrow">Selected Agent</span>
                  <h2>{selectedAgent.name}</h2>
                  <p>{selectedAgent.thesis}</p>
                </div>
              </div>

              <div className="score-stack">
                <ScoreBar label="Win rate" value={calculateScore(selectedAgent).winRate * 100} />
                <ScoreBar label="PnL score" value={calculateScore(selectedAgent).pnlScore} />
                <ScoreBar label="Calibration" value={calculateScore(selectedAgent).calibrationScore} />
                <ScoreBar label="Stake depth" value={calculateScore(selectedAgent).stakeScore} />
              </div>

              <div className="agent-stats">
                <Stat label="Followers" value={selectedAgent.followers.toLocaleString()} />
                <Stat label="Resolved" value={String(selectedAgent.resolvedSignals)} />
                <Stat label="Correct" value={String(selectedAgent.correctSignals)} />
                <Stat label="PnL" value={formatBps(selectedAgent.cumulativePnlBps)} />
              </div>

              <div className="markets">
                {selectedAgent.markets.map((market) => (
                  <span key={market}>{market}</span>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <aside className="settlement-rail" aria-label="Settlement details">
          <div className="section-head">
            <div>
              <span className="eyebrow">Settlement</span>
              <h2>Arc contract lane</h2>
            </div>
            <Blocks aria-hidden="true" />
          </div>

          <div className="settlement-stack">
            <SettlementItem
              icon={<WalletCards />}
              label="Stake token"
              value="USDC"
              detail="Escrowed per signal"
            />
            <SettlementItem
              icon={<BadgeCheck />}
              label="Contract ABI"
              value={`${signalBondAbi.length} methods`}
              detail="create, resolve, score"
            />
            <SettlementItem
              icon={<Activity />}
              label="Resolved calls"
              value={String(settledSignals.length)}
              detail="Reputation updates"
            />
            <SettlementItem
              icon={<Sparkles />}
              label="Judging edge"
              value="Agency + traction"
              detail="Built for the rubric"
            />
          </div>

          <div className="latest-signal">
            <span className="eyebrow">Latest Reasoning</span>
            <strong>{signals[0]?.market}</strong>
            <p>{signals[0]?.reasoning}</p>
            <div className="hash-row">
              <span>tx</span>
              <code>{shortHash(signals[0]?.txHash)}</code>
            </div>
            <div className="hash-row">
              <span>source</span>
              <code>{shortHash(signals[0]?.sourceHash)}</code>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function TopBar({
  activeSignals,
  totalStake,
}: {
  activeSignals: number;
  totalStake: number;
}) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Bot aria-hidden="true" />
        </div>
        <div>
          <strong>SignalBond</strong>
          <span>Agent reputation market</span>
        </div>
      </div>
      <div className="topbar-center">
        <span>Arc Canteen RPC</span>
        <strong>{activeSignals} live</strong>
        <strong>{formatUsdc(totalStake)} staked</strong>
      </div>
      <button className="wallet-button" type="button">
        <WalletCards aria-hidden="true" />
        Connect
      </button>
    </header>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ signal }: { signal: Signal }) {
  if (signal.status === "active") {
    return <span className="status active">Active</span>;
  }

  return (
    <span className={`status ${signal.correct ? "won" : "lost"}`}>
      {signal.correct ? "Won" : "Lost"} {formatBps(signal.pnlBps ?? 0)}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-bar">
      <div>
        <span>{label}</span>
        <strong>{value.toFixed(1)}</strong>
      </div>
      <div className="bar-track">
        <span style={{ width: `${Math.max(4, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettlementItem({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="settlement-item">
      <span>{icon}</span>
      <div>
        <em>{label}</em>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function isBullish(direction: Direction): boolean {
  return direction === "LONG" || direction === "YES";
}

function pseudoHash(input: string): `0x${string}` {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index);
  }

  const fragment = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}`;
}

function shortHash(hash?: string): string {
  if (!hash) return "0x";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
