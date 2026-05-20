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
  claimDemoUsdcOnchain,
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
  agentProposal?: AgentScan;
  publishStage: PublishStage;
  busy: {
    onchain: boolean;
    claim: boolean;
    scan: boolean;
  };
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  claimDemoUsdc: () => Promise<void>;
  runAgentCycle: () => Promise<void>;
  publishProposal: () => Promise<void>;
  dismissProposal: () => void;
  resolveSignal: (signal?: Signal) => Promise<void>;
  refreshChainState: () => Promise<void>;
  clearError: () => void;
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
  const [publishStage, setPublishStage] = useState<PublishStage>("idle");

  const arcChainHex = useMemo(() => numberToHexChainId(arcCanteen.id), []);
  const walletOnArc = walletChainId ? sameChainId(walletChainId, arcChainHex) : false;
  const isOnchainData = dataSourceMode === "onchain";

  const applyChainState = useCallback((dashboard: ChainState) => {
    setAgents(dashboard.agents);
    setSignals(dashboard.signals);
    setContractSignalCount(dashboard.signalCount);
    setWalletBalanceUsdc(dashboard.walletBalanceUsdc);
    setResolverAddress(dashboard.resolver);
    setOwnerAddress(dashboard.owner);
  }, []);

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

  const claimDemoUsdc = useCallback(async () => {
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
  }, [walletAddress, refreshOnchainState]);

  const runAgentCycle = useCallback(async () => {
    setScanBusy(true);
    setWalletError(undefined);
    try {
      const scan = await fetchAgentScan(scenarioIndex);
      setAgentProposal(scan);
      setScenarioIndex((value) => value + 1);
    } catch (error) {
      setWalletError(normalizeError(error));
    } finally {
      setScanBusy(false);
    }
  }, [scenarioIndex]);

  const publishProposal = useCallback(async () => {
    if (!agentProposal) return;
    const proposalSignal = scanToSignal(agentProposal, `proposal-${agentProposal.sourceHash}`);

    if (contractsConfigured) {
      if (!walletAddress) {
        setWalletError("Connect wallet before publishing this signal to Arc.");
        return;
      }

      setOnchainBusy(true);
      setWalletError(undefined);
      try {
        setPublishStage("approving");
        const txHash = await publishSignalOnchain(proposalSignal, walletAddress, (stage) =>
          setPublishStage(stage),
        );
        setLastOnchainTx(txHash);
        setPublishStage("confirming");
        await waitForOnchainTx(txHash);
        await refreshOnchainState(walletAddress);
        setAgentProposal(undefined);
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
  }, [agentProposal, walletAddress, refreshOnchainState]);

  const dismissProposal = useCallback(() => {
    if (publishStage !== "idle") return;
    setAgentProposal(undefined);
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
    },
    [
      signals,
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

  const clearError = useCallback(() => setWalletError(undefined), []);

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
      agentProposal,
      publishStage,
      busy: { onchain: onchainBusy, claim: claimBusy, scan: scanBusy },
      connectWallet,
      disconnectWallet,
      claimDemoUsdc,
      runAgentCycle,
      publishProposal,
      dismissProposal,
      resolveSignal,
      refreshChainState,
      clearError,
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
      agentProposal,
      publishStage,
      onchainBusy,
      claimBusy,
      scanBusy,
      connectWallet,
      disconnectWallet,
      claimDemoUsdc,
      runAgentCycle,
      publishProposal,
      dismissProposal,
      resolveSignal,
      refreshChainState,
      clearError,
    ],
  );

  // Suppress unused warning until score-based features consume calculateScore here.
  void calculateScore;

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
