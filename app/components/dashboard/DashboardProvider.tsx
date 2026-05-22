"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Address, Hex } from "viem";
import type { AgentScan } from "../../lib/agent-scan";
import {
  arcCanteen,
  contractsConfigured,
} from "../../lib/contract";
import { waitForOnchainTx } from "../../lib/onchain";
import {
  agents as seedAgents,
  signals as seedSignals,
} from "../../lib/seed";
import { calculateScore, settleAgent } from "../../lib/reputation";
import {
  ensureArcNetwork,
  fetchAgentScan,
  fetchChainState,
  normalizeError,
  numberToHexChainId,
  publishSignalOnchain,
  resetAgentStats,
  resolveSignalOnchain,
  sameChainId,
  scanToSignal,
} from "../../lib/dashboard-actions";
import type { ChainState } from "../../lib/chain-state";
import type { Agent, Signal } from "../../lib/types";

export type PublishStage = "idle" | "approving" | "publishing" | "confirming";
export type ProposalMode = "standard" | "quick-demo";

const QUICK_LIFECYCLE_SECONDS = 180;

export type PublishSuccess = {
  agentName: string;
  market: string;
  signalId?: number;
  stakeUsdc: number;
  txHash: Hex;
  contractSignalCount?: number;
  stakeDeltaUsdc: number;
  reputationDelta: number;
};

export type SettlementSuccess = {
  agentName: string;
  market: string;
  signalId?: number;
  stakeUsdc: number;
  txHash: Hex;
  correct: boolean;
  pnlBps: number;
  reputationBefore: number;
  reputationAfter: number;
  winRateBefore: number;
  winRateAfter: number;
  resolvedDelta: number;
};

export type DashboardContextValue = {
  agents: Agent[];
  signals: Signal[];
  walletAddress?: Address;
  walletError?: string;
  walletBalanceUsdc?: number;
  walletOnArc: boolean;
  isOnchainData: boolean;
  syncState: "idle" | "syncing" | "synced" | "failed";
  lastOnchainTx?: Hex;
  contractSignalCount?: number;
  resolverAddress?: Address;
  ownerAddress?: Address;
  treasuryAddress?: Address;
  slashedStakeUsdc: number;
  agentProposal?: AgentScan;
  agentProposalMode?: ProposalMode;
  selectedSignal?: Signal;
  publishStage: PublishStage;
  publishSuccess?: PublishSuccess;
  settlementSuccess?: SettlementSuccess;
  busy: {
    onchain: boolean;
    claim: boolean;
    scan: boolean;
  };
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  claimDemoUsdc: () => Promise<void>;
  runAgentCycle: () => Promise<void>;
  runQuickLifecycleDemo: () => Promise<void>;
  publishProposal: (overrides?: { stakeUsdc?: number }) => Promise<void>;
  dismissProposal: () => void;
  selectSignal: (signal: Signal) => void;
  closeSignalDetails: () => void;
  resolveSignal: (signal?: Signal) => Promise<void>;
  refreshChainState: () => Promise<void>;
  clearError: () => void;
  clearPublishSuccess: () => void;
  clearSettlementSuccess: () => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return ctx;
}

export default function DashboardProvider({
  initialChainState,
  children,
}: {
  initialChainState?: ChainState;
  children: ReactNode;
}) {
  const [agents, setAgents] = useState<Agent[]>(
    initialChainState?.agents ??
      (contractsConfigured ? seedAgents.map(resetAgentStats) : seedAgents),
  );
  const [signals, setSignals] = useState<Signal[]>(
    initialChainState?.signals ?? (contractsConfigured ? [] : seedSignals),
  );
  const [walletAddress, setWalletAddress] = useState<Address>();
  const [walletError, setWalletError] = useState<string>();
  const [walletChainId, setWalletChainId] = useState<Hex>();
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState<number | undefined>(
    initialChainState?.walletBalanceUsdc,
  );
  const [resolverAddress, setResolverAddress] = useState<Address | undefined>(
    initialChainState?.resolver,
  );
  const [ownerAddress, setOwnerAddress] = useState<Address | undefined>(
    initialChainState?.owner,
  );
  const [treasuryAddress, setTreasuryAddress] = useState<Address | undefined>(
    initialChainState?.treasury,
  );
  const [slashedStakeUsdc, setSlashedStakeUsdc] = useState(
    initialChainState?.summary.slashedStakeUsdc ?? 0,
  );
  const [contractSignalCount, setContractSignalCount] = useState<number | undefined>(
    initialChainState?.signalCount,
  );
  const [lastOnchainTx, setLastOnchainTx] = useState<Hex>();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "failed">(
    initialChainState ? "synced" : contractsConfigured ? "syncing" : "idle",
  );
  const [dataSourceMode, setDataSourceMode] = useState<"seed" | "onchain">(
    initialChainState || contractsConfigured ? "onchain" : "seed",
  );
  const [onchainBusy, setOnchainBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [agentProposal, setAgentProposal] = useState<AgentScan>();
  const [agentProposalMode, setAgentProposalMode] = useState<ProposalMode>();
  const [publishStage, setPublishStage] = useState<PublishStage>("idle");
  const [publishSuccess, setPublishSuccess] = useState<PublishSuccess>();
  const [settlementSuccess, setSettlementSuccess] = useState<SettlementSuccess>();
  const [selectedSignalId, setSelectedSignalId] = useState<string>();

  const arcChainHex = useMemo(() => numberToHexChainId(arcCanteen.id), []);
  const walletOnArc = walletChainId ? sameChainId(walletChainId, arcChainHex) : false;
  const isOnchainData = dataSourceMode === "onchain";
  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId),
    [signals, selectedSignalId],
  );

  const applyChainState = useCallback((dashboard: ChainState) => {
    setAgents(dashboard.agents);
    setSignals(dashboard.signals);
    setContractSignalCount(dashboard.signalCount);
    setWalletBalanceUsdc(dashboard.walletBalanceUsdc);
    setResolverAddress(dashboard.resolver);
    setOwnerAddress(dashboard.owner);
    setTreasuryAddress(dashboard.treasury);
    setSlashedStakeUsdc(dashboard.summary.slashedStakeUsdc);
  }, []);

  const refreshOnchainState = useCallback(
    async (account: Address | null | undefined = walletAddress) => {
      if (!contractsConfigured) {
        setAgents(seedAgents);
        setSignals(seedSignals);
        setDataSourceMode("seed");
        return undefined;
      }

      setSyncState("syncing");
      try {
        const dashboard = await fetchChainState(account ?? undefined);
        applyChainState(dashboard);
        setDataSourceMode("onchain");
        setSyncState("synced");
        setWalletError(undefined);
        return dashboard;
      } catch (error) {
        setSyncState("failed");
        setWalletError(normalizeError(error));
        return undefined;
      }
    },
    [walletAddress, applyChainState],
  );

  const refreshWalletChainId = useCallback(async () => {
    if (!window.ethereum) return;
    const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as Hex;
    setWalletChainId(chainId);
  }, []);

  useEffect(() => {
    void refreshOnchainState();
  }, [refreshOnchainState]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum?.on) return undefined;

    const handleAccountsChanged = (accounts: unknown) => {
      const [nextAccount] = Array.isArray(accounts) ? (accounts as Address[]) : [];
      if (!nextAccount) {
        setWalletAddress(undefined);
        setWalletBalanceUsdc(undefined);
        setWalletChainId(undefined);
        setLastOnchainTx(undefined);
        setPublishSuccess(undefined);
        setSettlementSuccess(undefined);
        setSelectedSignalId(undefined);
        setAgentProposalMode(undefined);
        void refreshOnchainState(null);
        return;
      }

      setWalletAddress(nextAccount);
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
  }, [refreshOnchainState, refreshWalletChainId]);

  const connectWallet = useCallback(async () => {
    setWalletError(undefined);
    if (!window.ethereum) {
      setWalletError("No injected wallet found. Install a browser wallet to publish onchain.");
      return;
    }

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as Address[];
      setWalletAddress(accounts[0]);
      await refreshOnchainState(accounts[0]);
      await refreshWalletChainId();
      try {
        const chainId = await ensureArcNetwork();
        setWalletChainId(chainId);
      } catch (error) {
        setWalletError(normalizeError(error));
      }
    } catch (error) {
      setWalletError(normalizeError(error));
    }
  }, [refreshOnchainState, refreshWalletChainId]);

  const disconnectWallet = useCallback(async () => {
    setWalletError(undefined);
    setWalletAddress(undefined);
    setWalletBalanceUsdc(undefined);
    setWalletChainId(undefined);
    setLastOnchainTx(undefined);
    setPublishSuccess(undefined);
    setSettlementSuccess(undefined);
    setSelectedSignalId(undefined);
    setAgentProposalMode(undefined);

    try {
      await window.ethereum?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets do not expose permission revocation. Local disconnect still works.
    }

    await refreshOnchainState(null);
  }, [refreshOnchainState]);

  /**
   * Real Arc Testnet USDC is dispensed via Circle's faucet (faucet.circle.com,
   * 20 USDC per 2h per address). There's no onchain claim to call, so this
   * just opens the faucet in a new tab — kept on the context for the sidebar
   * "Get USDC" card and any future faucet-aware UX.
   */
  const claimDemoUsdc = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.open("https://faucet.circle.com", "_blank", "noopener,noreferrer");
    }
  }, []);

  const runAgentCycle = useCallback(async () => {
    setScanBusy(true);
    setWalletError(undefined);
    setPublishSuccess(undefined);
    setSettlementSuccess(undefined);
    try {
      const scan = await fetchAgentScan(scenarioIndex);
      setAgentProposal(scan);
      setAgentProposalMode("standard");
      setScenarioIndex((value) => value + 1);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setScanBusy(false);
    }
  }, [scenarioIndex]);

  const runQuickLifecycleDemo = useCallback(async () => {
    setScanBusy(true);
    setWalletError(undefined);
    setPublishSuccess(undefined);
    setSettlementSuccess(undefined);
    try {
      const scan = await fetchAgentScan(scenarioIndex, {
        expiresInSeconds: QUICK_LIFECYCLE_SECONDS,
      });
      setAgentProposal(scan);
      setAgentProposalMode("quick-demo");
      setScenarioIndex((value) => value + 1);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setScanBusy(false);
    }
  }, [scenarioIndex]);

  const publishProposal = useCallback(async (overrides?: { stakeUsdc?: number }) => {
    if (!agentProposal) return;
    const proposalSignal = scanToSignal(agentProposal, `proposal-${agentProposal.sourceHash}`);
    const overrideStake = overrides?.stakeUsdc;
    if (
      typeof overrideStake === "number" &&
      Number.isFinite(overrideStake) &&
      overrideStake > 0
    ) {
      proposalSignal.stakeUsdc = overrideStake;
    }
    const publishingQuickDemo = agentProposalMode === "quick-demo";

    if (contractsConfigured) {
      if (!walletAddress) {
        setWalletError("Connect wallet before publishing this signal to Arc.");
        return;
      }

      setOnchainBusy(true);
      setWalletError(undefined);
      setPublishSuccess(undefined);
      setSettlementSuccess(undefined);
      try {
        const agentBefore = agents.find((agent) => agent.id === proposalSignal.agentId);
        const scoreBefore = agentBefore ? calculateScore(agentBefore).reputation : undefined;
        const previousStake = agentBefore?.stakedUsdc ?? 0;
        setPublishStage("approving");
        const txHash = await publishSignalOnchain(proposalSignal, walletAddress, (stage) =>
          setPublishStage(stage),
        );
        setLastOnchainTx(txHash);
        setPublishStage("confirming");
        await waitForOnchainTx(txHash);
        const dashboard = await refreshOnchainState(walletAddress);
        const publishedSignal =
          dashboard?.signals.find((signal) => signal.txHash.toLowerCase() === txHash.toLowerCase()) ??
          dashboard?.signals.find(
            (signal) =>
              signal.sourceHash.toLowerCase() === proposalSignal.sourceHash.toLowerCase(),
          );
        const agentAfter =
          dashboard?.agents.find((agent) => agent.id === proposalSignal.agentId) ?? agentBefore;
        const scoreAfter = agentAfter ? calculateScore(agentAfter).reputation : undefined;
        setPublishSuccess({
          agentName: agentAfter?.name ?? agentBefore?.name ?? proposalSignal.agentId,
          market: proposalSignal.market,
          signalId: publishedSignal?.onchainId,
          stakeUsdc: proposalSignal.stakeUsdc,
          txHash,
          contractSignalCount: dashboard?.signalCount,
          stakeDeltaUsdc: Math.max(0, (agentAfter?.stakedUsdc ?? previousStake) - previousStake),
          reputationDelta:
            scoreBefore === undefined || scoreAfter === undefined
              ? 0
              : Math.max(0, scoreAfter - scoreBefore),
        });
        if (publishingQuickDemo && publishedSignal) {
          setSelectedSignalId(publishedSignal.id);
        }
        setAgentProposal(undefined);
        setAgentProposalMode(undefined);
      } catch (error) {
        setWalletError(normalizeError(error));
      } finally {
        setPublishStage("idle");
        setOnchainBusy(false);
      }
      return;
    }

    setSignals((current) => [proposalSignal, ...current]);
    setAgentProposal(undefined);
    setAgentProposalMode(undefined);
  }, [agentProposal, agentProposalMode, agents, walletAddress, refreshOnchainState]);

  const dismissProposal = useCallback(() => {
    if (publishStage !== "idle") return;
    setAgentProposal(undefined);
    setAgentProposalMode(undefined);
  }, [publishStage]);

  const resolveSignal = useCallback(
    async (target?: Signal) => {
      const nextActive = target ?? signals.find((signal) => signal.status === "active");
      if (!nextActive) return;

      const correct = scenarioIndex % 4 !== 2;
      const directionMultiplier =
        nextActive.direction === "SHORT" || nextActive.direction === "NO" ? -1 : 1;
      const rawMove =
        ((nextActive.targetPrice - nextActive.entryPrice) / nextActive.entryPrice) *
        10_000 *
        directionMultiplier;
      const pnlBps = Math.round(
        correct ? Math.abs(rawMove) : -Math.abs(rawMove) * 0.7,
      );

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
          setWalletError(
            `Onchain resolution unlocks after ${new Date(nextActive.expiresAt).toLocaleString()}.`,
          );
          return;
        }

        setOnchainBusy(true);
        setWalletError(undefined);
        setPublishSuccess(undefined);
        setSettlementSuccess(undefined);
        try {
          const agentBefore = agents.find((agent) => agent.id === nextActive.agentId);
          const beforeScore = agentBefore ? calculateScore(agentBefore).reputation : 0;
          const beforeWinRate = readWinRate(agentBefore);
          const beforeResolved = agentBefore?.resolvedSignals ?? 0;
          const txHash = await resolveSignalOnchain(nextActive, walletAddress, correct, pnlBps);
          setLastOnchainTx(txHash);
          await waitForOnchainTx(txHash);
          const dashboard = await refreshOnchainState(walletAddress);
          const agentAfter =
            dashboard?.agents.find((agent) => agent.id === nextActive.agentId) ?? agentBefore;
          const afterScore = agentAfter ? calculateScore(agentAfter).reputation : beforeScore;
          setSettlementSuccess({
            agentName: agentAfter?.name ?? agentBefore?.name ?? nextActive.agentId,
            market: nextActive.market,
            signalId: nextActive.onchainId,
            stakeUsdc: nextActive.stakeUsdc,
            txHash,
            correct,
            pnlBps,
            reputationBefore: beforeScore,
            reputationAfter: afterScore,
            winRateBefore: beforeWinRate,
            winRateAfter: readWinRate(agentAfter),
            resolvedDelta: Math.max(
              0,
              (agentAfter?.resolvedSignals ?? beforeResolved) - beforeResolved,
            ),
          });
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
      const agentBefore = agents.find((agent) => agent.id === nextActive.agentId);
      const beforeScore = agentBefore ? calculateScore(agentBefore).reputation : 0;
      const beforeWinRate = readWinRate(agentBefore);
      const settledAgent = agentBefore
        ? settleAgent(agentBefore, {
            correct,
            pnlBps,
            stakeUsdc: nextActive.stakeUsdc,
            confidenceBps: nextActive.confidenceBps,
          })
        : undefined;

      setAgents((current) =>
        current.map((agent) =>
          agent.id === nextActive.agentId && settledAgent ? settledAgent : agent,
        ),
      );
      if (settledAgent) {
        setSettlementSuccess({
          agentName: settledAgent.name,
          market: nextActive.market,
          signalId: nextActive.onchainId,
          stakeUsdc: nextActive.stakeUsdc,
          txHash: nextActive.txHash,
          correct,
          pnlBps,
          reputationBefore: beforeScore,
          reputationAfter: calculateScore(settledAgent).reputation,
          winRateBefore: beforeWinRate,
          winRateAfter: readWinRate(settledAgent),
          resolvedDelta: 1,
        });
      }
    },
    [
      signals,
      agents,
      scenarioIndex,
      isOnchainData,
      walletAddress,
      resolverAddress,
      ownerAddress,
      refreshOnchainState,
    ],
  );

  const refreshChainState = useCallback(async () => {
    await refreshOnchainState();
  }, [refreshOnchainState]);

  const selectSignal = useCallback((signal: Signal) => setSelectedSignalId(signal.id), []);
  const closeSignalDetails = useCallback(() => setSelectedSignalId(undefined), []);
  const clearError = useCallback(() => setWalletError(undefined), []);
  const clearPublishSuccess = useCallback(() => setPublishSuccess(undefined), []);
  const clearSettlementSuccess = useCallback(() => setSettlementSuccess(undefined), []);

  const value = useMemo<DashboardContextValue>(
    () => ({
      agents,
      signals,
      walletAddress,
      walletError,
      walletBalanceUsdc,
      walletOnArc,
      isOnchainData,
      syncState,
      lastOnchainTx,
      contractSignalCount,
      resolverAddress,
      ownerAddress,
      treasuryAddress,
      slashedStakeUsdc,
      agentProposal,
      agentProposalMode,
      selectedSignal,
      publishStage,
      publishSuccess,
      settlementSuccess,
      busy: { onchain: onchainBusy, claim: claimBusy, scan: scanBusy },
      connectWallet,
      disconnectWallet,
      claimDemoUsdc,
      runAgentCycle,
      runQuickLifecycleDemo,
      publishProposal,
      dismissProposal,
      selectSignal,
      closeSignalDetails,
      resolveSignal,
      refreshChainState,
      clearError,
      clearPublishSuccess,
      clearSettlementSuccess,
    }),
    [
      agents,
      signals,
      walletAddress,
      walletError,
      walletBalanceUsdc,
      walletOnArc,
      isOnchainData,
      syncState,
      lastOnchainTx,
      contractSignalCount,
      resolverAddress,
      ownerAddress,
      treasuryAddress,
      slashedStakeUsdc,
      agentProposal,
      agentProposalMode,
      selectedSignal,
      publishStage,
      publishSuccess,
      settlementSuccess,
      onchainBusy,
      claimBusy,
      scanBusy,
      connectWallet,
      disconnectWallet,
      claimDemoUsdc,
      runAgentCycle,
      runQuickLifecycleDemo,
      publishProposal,
      dismissProposal,
      selectSignal,
      closeSignalDetails,
      resolveSignal,
      refreshChainState,
      clearError,
      clearPublishSuccess,
      clearSettlementSuccess,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

function readWinRate(agent: Agent | undefined): number {
  if (!agent || agent.resolvedSignals === 0) {
    return 0;
  }

  return agent.correctSignals / agent.resolvedSignals;
}
