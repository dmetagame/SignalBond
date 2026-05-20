"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  Bot,
  Copy,
  CircleDollarSign,
  Gauge,
  Layers3,
  Play,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  TimerReset,
  Trophy,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createWalletClient,
  custom,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  arcCanteen,
  contractsConfigured,
  demoUsdcAddress,
  erc20Abi,
  signalBondAbi,
  signalBondAddress,
} from "./lib/contract";
import {
  agentHash,
  getPublicClient,
  waitForOnchainTx,
} from "./lib/onchain";
import { agents as seedAgents, marketTape, signals as seedSignals } from "./lib/seed";
import {
  directionToContractValue,
  generateAgentScan,
  type AgentScan,
} from "./lib/agent-scan";
import type { ChainState } from "./lib/chain-state";
import { calculateScore, formatBps, formatUsdc, settleAgent } from "./lib/reputation";
import type { Agent, Direction, Signal } from "./lib/types";

declare global {
  interface Window {
    ethereum?: {
      on?(event: string, handler: (...args: unknown[]) => void): void;
      removeListener?(event: string, handler: (...args: unknown[]) => void): void;
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}

export default function DashboardClient({
  initialChainState,
}: {
  initialChainState?: ChainState;
}) {
  const [agents, setAgents] = useState<Agent[]>(
    initialChainState?.agents ??
      (contractsConfigured ? seedAgents.map(resetAgentStats) : seedAgents),
  );
  const [signals, setSignals] = useState<Signal[]>(
    initialChainState?.signals ?? (contractsConfigured ? [] : seedSignals),
  );
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState(seedAgents[0].id);
  const [walletAddress, setWalletAddress] = useState<Address>();
  const [walletError, setWalletError] = useState<string>();
  const [lastOnchainTx, setLastOnchainTx] = useState<Hex>();
  const [onchainBusy, setOnchainBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState<"seed" | "onchain">(
    initialChainState || contractsConfigured ? "onchain" : "seed",
  );
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "failed">(
    initialChainState ? "synced" : contractsConfigured ? "syncing" : "idle",
  );
  const [contractSignalCount, setContractSignalCount] = useState<number | undefined>(
    initialChainState?.signalCount,
  );
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState<number | undefined>(
    initialChainState?.walletBalanceUsdc,
  );
  const [resolverAddress, setResolverAddress] = useState<Address | undefined>(
    initialChainState?.resolver,
  );
  const [ownerAddress, setOwnerAddress] = useState<Address | undefined>(
    initialChainState?.owner,
  );
  const [agentProposal, setAgentProposal] = useState<AgentScan>();
  const [scanBusy, setScanBusy] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "approving" | "publishing" | "confirming"
  >("idle");
  const [copiedHash, setCopiedHash] = useState<string>();
  const [walletChainId, setWalletChainId] = useState<Hex>();
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);
  const [networkBusy, setNetworkBusy] = useState(false);

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
  const latestSignal = signals[0];
  const isOnchainData = dataSourceMode === "onchain";
  const arcChainId = numberToHexChainId(arcCanteen.id);
  const walletOnArc = walletChainId
    ? sameChainId(walletChainId, arcChainId)
    : false;
  const proposalSignal = useMemo(
    () =>
      agentProposal
        ? scanToSignal(agentProposal, `proposal-${agentProposal.sourceHash}`)
        : undefined,
    [agentProposal],
  );

  function applyChainState(dashboard: ChainState) {
    setAgents(dashboard.agents);
    setSignals(dashboard.signals);
    setContractSignalCount(dashboard.signalCount);
    setWalletBalanceUsdc(dashboard.walletBalanceUsdc);
    setResolverAddress(dashboard.resolver);
    setOwnerAddress(dashboard.owner);
  }

  const refreshOnchainState = useCallback(
    async (account: Address | null | undefined = walletAddress) => {
      if (!contractsConfigured) {
        setAgents(seedAgents);
        setSignals(seedSignals);
        setDataSourceMode("seed");
        return;
      }

      setSyncState("syncing");
      try {
        const dashboard = await fetchChainState(account ?? undefined);
        applyChainState(dashboard);
        setDataSourceMode("onchain");
        setSyncState("synced");
        setWalletError(undefined);
      } catch (error) {
        setSyncState("failed");
        setWalletError(normalizeError(error));
      }
    },
    [walletAddress],
  );

  useEffect(() => {
    void refreshOnchainState();
  }, [refreshOnchainState]);

  useEffect(() => {
    if (!window.ethereum?.on) return undefined;

    const handleAccountsChanged = (accounts: unknown) => {
      const [nextAccount] = Array.isArray(accounts) ? (accounts as Address[]) : [];
      if (!nextAccount) {
        setWalletAddress(undefined);
        setWalletBalanceUsdc(undefined);
        setWalletChainId(undefined);
        setNetworkDialogOpen(false);
        setLastOnchainTx(undefined);
        void refreshOnchainState(null);
        return;
      }

      setWalletAddress(nextAccount);
      setNetworkDialogOpen(true);
      void refreshOnchainState(nextAccount);
      void refreshWalletChainId();
    };

    const handleChainChanged = (chainId: unknown) => {
      if (typeof chainId === "string") {
        setWalletChainId(chainId as Hex);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshOnchainState]);

  async function connectWallet() {
    setWalletError(undefined);
    if (!window.ethereum) {
      setWalletError("No injected wallet found. Install a browser wallet to publish onchain.");
      return;
    }

    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as Address[];
    setWalletAddress(accounts[0]);
    await refreshOnchainState(accounts[0]);
    await refreshWalletChainId();
    await promptArcNetwork(false, accounts[0]);
  }

  async function disconnectWallet() {
    setWalletError(undefined);
    setWalletAddress(undefined);
    setWalletBalanceUsdc(undefined);
    setWalletChainId(undefined);
    setNetworkDialogOpen(false);
    setLastOnchainTx(undefined);

    try {
      await window.ethereum?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets do not expose permission revocation. Local disconnect still works.
    }

    await refreshOnchainState(null);
  }

  async function refreshWalletChainId() {
    if (!window.ethereum) return;
    const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as Hex;
    setWalletChainId(chainId);
  }

  async function promptArcNetwork(closeOnSuccess: boolean, account = walletAddress) {
    if (!account) return;

    setNetworkDialogOpen(true);
    setNetworkBusy(true);
    setWalletError(undefined);
    try {
      const chainId = await ensureArcNetwork();
      setWalletChainId(chainId);
      if (closeOnSuccess) {
        setNetworkDialogOpen(false);
      }
    } catch (error) {
      setWalletError(normalizeError(error));
      setNetworkDialogOpen(true);
    } finally {
      setNetworkBusy(false);
    }
  }

  async function claimDemoUsdc() {
    setWalletError(undefined);
    if (!contractsConfigured) {
      setWalletError("Demo contracts are not configured yet.");
      return;
    }
    if (!walletAddress) {
      setWalletError("Connect wallet before claiming demo USDC.");
      return;
    }

    setClaimBusy(true);
    try {
      const txHash = await claimDemoUsdcOnchain(walletAddress);
      setLastOnchainTx(txHash);
      await waitForOnchainTx(txHash);
      await refreshOnchainState(walletAddress);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setClaimBusy(false);
    }
  }

  async function runAgentCycle() {
    setScanBusy(true);
    setWalletError(undefined);
    try {
      const scan = await fetchAgentScan(scenarioIndex);
      setAgentProposal(scan);
      setSelectedAgentId(scan.agentId);
      setScenarioIndex((value) => value + 1);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setScanBusy(false);
    }
  }

  async function publishAgentProposal() {
    if (!proposalSignal || !agentProposal) return;

    let onchainTxHash: Hex | undefined;
    let publishedOnchain = false;

    if (contractsConfigured) {
      if (!walletAddress) {
        setWalletError("Connect wallet before publishing this signal to Arc.");
        return;
      }

      setOnchainBusy(true);
      setWalletError(undefined);
      try {
        setPublishStage("approving");
        onchainTxHash = await publishSignalOnchain(
          proposalSignal,
          walletAddress,
          (stage) => setPublishStage(stage),
        );
        setLastOnchainTx(onchainTxHash);
        setPublishStage("confirming");
        await waitForOnchainTx(onchainTxHash);
        await refreshOnchainState(walletAddress);
        publishedOnchain = true;
        setAgentProposal(undefined);
      } catch (error) {
        setWalletError(normalizeError(error));
      } finally {
        setPublishStage("idle");
        setOnchainBusy(false);
      }
    }

    if (!publishedOnchain && !contractsConfigured) {
      setSignals((current) => [
        { ...proposalSignal, txHash: onchainTxHash ?? proposalSignal.txHash },
        ...current,
      ]);
      setAgentProposal(undefined);
    }
  }

  async function copyHash(value?: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedHash(value);
      window.setTimeout(() => {
        setCopiedHash((current) => (current === value ? undefined : current));
      }, 1400);
    } catch {
      setWalletError("Clipboard access is unavailable in this browser.");
    }
  }

  async function resolveSignal() {
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

    if (isOnchainData && contractsConfigured) {
      if (!walletAddress) {
        setWalletError("Connect the resolver wallet to settle an onchain signal.");
        return;
      }

      if (!nextActive.onchainId) {
        setWalletError("This signal has no onchain id to resolve.");
        return;
      }

      if (
        resolverAddress &&
        ownerAddress &&
        walletAddress.toLowerCase() !== resolverAddress.toLowerCase() &&
        walletAddress.toLowerCase() !== ownerAddress.toLowerCase()
      ) {
        setWalletError("Only the contract resolver or owner can resolve onchain signals.");
        return;
      }

      if (new Date(nextActive.expiresAt).getTime() > Date.now()) {
        setWalletError(`Onchain resolution unlocks after ${new Date(nextActive.expiresAt).toLocaleString()}.`);
        return;
      }

      setOnchainBusy(true);
      setWalletError(undefined);
      try {
        const txHash = await resolveSignalOnchain(nextActive, walletAddress, correct, pnlBps);
        setLastOnchainTx(txHash);
        await waitForOnchainTx(txHash);
        await refreshOnchainState(walletAddress);
      } catch (error) {
        setWalletError(normalizeError(error));
      } finally {
        setOnchainBusy(false);
      }
      return;
    }

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
      <TopBar
        activeSignals={activeSignals.length}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        onNetworkOpen={() => setNetworkDialogOpen(true)}
        networkReady={walletOnArc}
        totalStake={totalStake}
        walletAddress={walletAddress}
      />

      {networkDialogOpen && walletAddress ? (
        <NetworkDialog
          busy={networkBusy}
          chainId={walletChainId}
          onClose={() => setNetworkDialogOpen(false)}
          onSwitch={() => promptArcNetwork(true)}
          ready={walletOnArc}
          walletAddress={walletAddress}
        />
      ) : null}

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
              <button
                className="secondary-action"
                disabled={claimBusy}
                onClick={claimDemoUsdc}
                type="button"
              >
                <WalletCards aria-hidden="true" />
                {claimBusy ? "Claiming..." : "Claim Demo USDC"}
              </button>
              <button
                className="primary-action"
                disabled={scanBusy || onchainBusy}
                onClick={runAgentCycle}
                type="button"
              >
                <Play aria-hidden="true" />
                {scanBusy ? "Scanning..." : "Run Agent Cycle"}
              </button>
              <button
                className="secondary-action"
                disabled={onchainBusy}
                onClick={resolveSignal}
                type="button"
              >
                <ShieldCheck aria-hidden="true" />
                Resolve Signal
              </button>
            </div>
          </div>

          <div className="mode-strip">
            <span className={isOnchainData ? "mode live" : "mode sim"}>
              {syncState === "syncing"
                ? "Reading onchain"
                : isOnchainData
                  ? "Onchain data"
                  : "Simulation mode"}
            </span>
            {contractSignalCount !== undefined ? (
              <span>
                Contract signals: <code>{contractSignalCount}</code>
              </span>
            ) : null}
            <span>
              SignalBond: <code>{signalBondAddress ? shortHash(signalBondAddress) : "not configured"}</code>
            </span>
            <span>
              Demo USDC: <code>{demoUsdcAddress ? shortHash(demoUsdcAddress) : "not configured"}</code>
            </span>
            {walletBalanceUsdc !== undefined ? (
              <span>
                Demo balance: <code>{formatUsdc(walletBalanceUsdc)}</code>
              </span>
            ) : null}
            {resolverAddress ? (
              <span>
                Resolver: <code>{shortHash(resolverAddress)}</code>
              </span>
            ) : null}
            {lastOnchainTx ? (
              <span>
                Last tx: <code>{shortHash(lastOnchainTx)}</code>
              </span>
            ) : null}
            <button
              className="mode-refresh"
              disabled={syncState === "syncing"}
              onClick={() => refreshOnchainState()}
              type="button"
            >
              <RefreshCw aria-hidden="true" />
              Refresh
            </button>
            {walletError ? <strong>{walletError}</strong> : null}
          </div>

          {agentProposal && proposalSignal ? (
            <AgentProposalTicket
              agent={agents.find((agent) => agent.id === agentProposal.agentId)}
              copiedHash={copiedHash}
              onCopyHash={copyHash}
              onDismiss={() => setAgentProposal(undefined)}
              onPublish={publishAgentProposal}
              publishStage={publishStage}
              publishing={onchainBusy}
              scan={agentProposal}
              signal={proposalSignal}
            />
          ) : null}

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
                {signals.length === 0 ? (
                  <div className="signal-empty" role="row">
                    <strong>No onchain signals yet</strong>
                    <span>Connect a wallet, claim demo USDC, and run an agent cycle to mint the first SignalBond record.</span>
                  </div>
                ) : null}
                {signals.map((signal) => {
                  const agent = agents.find((item) => item.id === signal.agentId);
                  return (
                    <div className="signal-tr" key={signal.id} role="row">
                      <span>
                        <strong>{signal.market}</strong>
                        <em>{signal.venue}</em>
                      </span>
                      <span>{agent?.handle ?? shortHash(signal.agentId)}</span>
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
              label="Contract mode"
              value={contractsConfigured ? "Ready" : "Sim only"}
              detail={contractsConfigured ? "Env addresses configured" : "Set Vercel envs after deploy"}
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
            <strong>{latestSignal?.market ?? "No signal minted yet"}</strong>
            <p>
              {latestSignal?.reasoning ??
                "The next agent cycle will write a source hash, stake amount, and market direction to Arc."}
            </p>
            <HashRow
              copied={copiedHash === latestSignal?.txHash}
              label="tx"
              onCopy={copyHash}
              value={latestSignal?.txHash}
            />
            <HashRow
              copied={copiedHash === latestSignal?.sourceHash}
              label="source"
              onCopy={copyHash}
              value={latestSignal?.sourceHash}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function AgentProposalTicket({
  agent,
  copiedHash,
  onCopyHash,
  onDismiss,
  onPublish,
  publishing,
  publishStage,
  scan,
  signal,
}: {
  agent?: Agent;
  copiedHash?: string;
  onCopyHash: (value?: string) => void;
  onDismiss: () => void;
  onPublish: () => void;
  publishing: boolean;
  publishStage: "idle" | "approving" | "publishing" | "confirming";
  scan: AgentScan;
  signal: Signal;
}) {
  const explanationHash = keccak256(stringToHex(scan.reasoning));
  const moveBps = Math.round(
    ((scan.targetPrice - scan.entryPrice) / scan.entryPrice) * 10_000,
  );

  return (
    <section className="proposal-ticket" aria-label="Agent proposal">
      <div className="proposal-head">
        <div>
          <span className="eyebrow">Agent Proposal</span>
          <h2>{scan.market}</h2>
        </div>
        <button
          aria-label="Dismiss proposal"
          className="icon-button"
          disabled={publishing}
          onClick={onDismiss}
          title="Dismiss proposal"
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="proposal-grid">
        <div className="proposal-primary">
          <div className="proposal-agent">
            <span
              className="agent-mark"
              style={{ backgroundColor: agent?.color ?? "var(--green)" }}
            />
            <div>
              <strong>{agent?.name ?? shortHash(scan.agentId)}</strong>
              <em>{agent?.handle ?? scan.agentId} / {scan.venue}</em>
            </div>
          </div>
          <p>{scan.reasoning}</p>
          <div className="proposal-sources">
            {scan.sources.map((source) => (
              <span key={source}>{source}</span>
            ))}
          </div>
        </div>

        <div className="proposal-metrics">
          <ProposalStat
            label="Side"
            tone={isBullish(scan.direction) ? "positive" : "negative"}
            value={scan.direction}
          />
          <ProposalStat
            label="Confidence"
            value={`${(scan.confidenceBps / 100).toFixed(1)}%`}
          />
          <ProposalStat label="Stake" value={formatUsdc(scan.stakeUsdc)} />
          <ProposalStat
            label="Target move"
            tone={moveBps >= 0 ? "positive" : "negative"}
            value={formatBps(moveBps)}
          />
        </div>
      </div>

      <div className="proposal-audit">
        <HashRow
          copied={copiedHash === signal.sourceHash}
          label="source hash"
          onCopy={onCopyHash}
          value={signal.sourceHash}
        />
        <HashRow
          copied={copiedHash === explanationHash}
          label="reason hash"
          onCopy={onCopyHash}
          value={explanationHash}
        />
        <div className="hash-row">
          <span>expires</span>
          <code>{new Date(scan.expiresAt).toLocaleString()}</code>
        </div>
      </div>

      <div className="proposal-actions">
        <span>{publishStageLabel(publishStage)}</span>
        <button
          className="primary-action"
          disabled={publishing}
          onClick={onPublish}
          type="button"
        >
          <RadioTower aria-hidden="true" />
          {publishing ? "Publishing..." : "Publish Signal"}
        </button>
      </div>
    </section>
  );
}

function ProposalStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "positive" | "negative";
  value: string;
}) {
  return (
    <div className="proposal-stat">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function HashRow({
  copied,
  label,
  onCopy,
  value,
}: {
  copied?: boolean;
  label: string;
  onCopy: (value?: string) => void;
  value?: string;
}) {
  return (
    <div className="hash-row">
      <span>{label}</span>
      <code>{shortHash(value)}</code>
      <button
        aria-label={`Copy ${label}`}
        className={`hash-copy ${copied ? "copied" : ""}`}
        disabled={!value}
        onClick={() => onCopy(value)}
        title={copied ? "Copied" : `Copy ${label}`}
        type="button"
      >
        <Copy aria-hidden="true" />
      </button>
    </div>
  );
}

function publishStageLabel(stage: "idle" | "approving" | "publishing" | "confirming") {
  switch (stage) {
    case "approving":
      return "Approval pending";
    case "publishing":
      return "Create signal pending";
    case "confirming":
      return "Waiting for Arc finality";
    case "idle":
      return "Ready to publish";
  }
}

function NetworkDialog({
  busy,
  chainId,
  onClose,
  onSwitch,
  ready,
  walletAddress,
}: {
  busy: boolean;
  chainId?: Hex;
  onClose: () => void;
  onSwitch: () => void;
  ready: boolean;
  walletAddress: Address;
}) {
  return (
    <div className="network-overlay" role="dialog" aria-modal="true">
      <section className="network-card" aria-label="Wallet network">
        <div className="proposal-head">
          <div>
            <span className="eyebrow">Wallet Network</span>
            <h2>{ready ? "Arc Testnet ready" : "Switch to Arc Testnet"}</h2>
          </div>
          <button
            aria-label="Close network dialog"
            className="icon-button"
            disabled={busy}
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="network-summary">
          <div>
            <span>Wallet</span>
            <strong>{shortHash(walletAddress)}</strong>
          </div>
          <div>
            <span>Current chain</span>
            <strong className={ready ? "positive" : "negative"}>
              {chainId ?? "unknown"}
            </strong>
          </div>
          <div>
            <span>Target chain</span>
            <strong>{numberToHexChainId(arcCanteen.id)}</strong>
          </div>
          <div>
            <span>RPC</span>
            <strong>{arcCanteen.rpcUrls.default.http[0]}</strong>
          </div>
        </div>

        <div className="network-actions">
          <button className="secondary-action" disabled={busy} onClick={onClose} type="button">
            Later
          </button>
          <button
            className="primary-action"
            disabled={busy}
            onClick={ready ? onClose : onSwitch}
            type="button"
          >
            <WalletCards aria-hidden="true" />
            {busy ? "Opening wallet..." : ready ? "Continue" : "Switch Network"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TopBar({
  activeSignals,
  onConnect,
  onDisconnect,
  onNetworkOpen,
  networkReady,
  totalStake,
  walletAddress,
}: {
  activeSignals: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onNetworkOpen: () => void;
  networkReady: boolean;
  totalStake: number;
  walletAddress?: Address;
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
      {walletAddress ? (
        <div className="wallet-cluster">
          <button
            className={`wallet-button connected ${networkReady ? "ready" : "needs-network"}`}
            onClick={onNetworkOpen}
            type="button"
          >
            <WalletCards aria-hidden="true" />
            <span>{shortHash(walletAddress)}</span>
          </button>
          <button
            aria-label="Disconnect wallet"
            className="wallet-disconnect"
            onClick={onDisconnect}
            title="Disconnect wallet"
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button className="wallet-button" onClick={onConnect} type="button">
          <WalletCards aria-hidden="true" />
          Connect
        </button>
      )}
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

function resetAgentStats(agent: Agent): Agent {
  return {
    ...agent,
    stakedUsdc: 0,
    resolvedSignals: 0,
    correctSignals: 0,
    cumulativePnlBps: 0,
    calibrationBps: 0,
    maxDrawdownBps: 0,
  };
}

function scanToSignal(scan: AgentScan, id: string): Signal {
  return {
    id,
    agentId: scan.agentId,
    market: scan.market,
    venue: scan.venue,
    direction: scan.direction,
    confidenceBps: scan.confidenceBps,
    stakeUsdc: scan.stakeUsdc,
    entryPrice: scan.entryPrice,
    targetPrice: scan.targetPrice,
    createdAt: scan.generatedAt,
    expiresAt: scan.expiresAt,
    status: "active",
    sourceHash: scan.sourceHash,
    txHash: pseudoHash(`${id}:${scan.market}:tx`),
    reasoning: scan.reasoning,
    sources: scan.sources,
  };
}

async function publishSignalOnchain(
  signal: Signal,
  account: Address,
  onStage?: (stage: "approving" | "publishing" | "confirming") => void,
): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  if (!signalBondAddress || !demoUsdcAddress) {
    throw new Error("Contract addresses are not configured.");
  }

  await ensureArcNetwork();

  const walletClient = createWalletClient({
    account,
    chain: arcCanteen,
    transport: custom(window.ethereum),
  });
  const publicClient = getPublicClient();
  const stakeAmount = parseUnits(String(signal.stakeUsdc), 6);

  onStage?.("approving");
  const approveHash = await walletClient.writeContract({
    address: demoUsdcAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [signalBondAddress, stakeAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  onStage?.("publishing");
  return walletClient.writeContract({
    address: signalBondAddress,
    abi: signalBondAbi,
    functionName: "createSignal",
    args: [
      agentHash(signal.agentId),
      signal.market,
      directionToContractValue(signal.direction),
      signal.confidenceBps,
      stakeAmount,
      BigInt(Math.floor(new Date(signal.expiresAt).getTime() / 1000)),
      signal.sourceHash,
      keccak256(stringToHex(signal.reasoning)),
    ],
  });
}

async function resolveSignalOnchain(
  signal: Signal,
  account: Address,
  correct: boolean,
  pnlBps: number,
): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  if (!signalBondAddress || !signal.onchainId) {
    throw new Error("SignalBond address or onchain signal id is not configured.");
  }

  await ensureArcNetwork();

  const walletClient = createWalletClient({
    account,
    chain: arcCanteen,
    transport: custom(window.ethereum),
  });

  return walletClient.writeContract({
    address: signalBondAddress,
    abi: signalBondAbi,
    functionName: "resolveSignal",
    args: [BigInt(signal.onchainId), correct, BigInt(pnlBps)],
  });
}

async function claimDemoUsdcOnchain(account: Address): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  if (!demoUsdcAddress) {
    throw new Error("Demo USDC address is not configured.");
  }

  await ensureArcNetwork();

  const walletClient = createWalletClient({
    account,
    chain: arcCanteen,
    transport: custom(window.ethereum),
  });

  return walletClient.writeContract({
    address: demoUsdcAddress,
    abi: erc20Abi,
    functionName: "claim",
  });
}

async function ensureArcNetwork(): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  const chainId = numberToHexChainId(arcCanteen.id);
  const currentChainId = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;

  if (currentChainId.toLowerCase() === chainId.toLowerCase()) {
    return chainId;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if (!isUnknownChainError(error)) {
      throw error;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: arcCanteen.name,
          nativeCurrency: arcCanteen.nativeCurrency,
          rpcUrls: arcCanteen.rpcUrls.default.http,
        },
      ],
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }

  return chainId;
}

function numberToHexChainId(value: number): Hex {
  return `0x${value.toString(16)}`;
}

function sameChainId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isUnknownChainError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 4902
  );
}

function pseudoHash(input: string): `0x${string}` {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index);
  }

  const fragment = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}`;
}

async function fetchAgentScan(sequence: number): Promise<AgentScan> {
  try {
    const response = await fetch(`/api/agent-scan?sequence=${sequence}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Agent scan failed with ${response.status}.`);
    }

    const payload = (await response.json()) as { signal: AgentScan };
    return payload.signal;
  } catch {
    return generateAgentScan({ sequence });
  }
}

async function fetchChainState(account?: Address): Promise<ChainState> {
  const url = new URL("/api/chain-state", window.location.origin);
  if (account) {
    url.searchParams.set("account", account);
  }

  const response = await fetch(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Chain state failed with ${response.status}.`);
  }

  return response.json() as Promise<ChainState>;
}

function shortHash(hash?: string): string {
  if (!hash) return "0x";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Transaction failed.";
}
