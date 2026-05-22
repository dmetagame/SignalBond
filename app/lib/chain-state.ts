import type { Address } from "viem";
import type { Agent, Signal } from "./types";
import type { OnchainDashboard } from "./onchain";
import {
  contractsConfigured,
  demoUsdcAddress,
  signalBondAddress,
} from "./contract";

export type ChainState = {
  agents: Agent[];
  blockNumber: string;
  contracts: {
    configured: boolean;
    demoUsdcAddress?: Address;
    signalBondAddress?: Address;
  };
  generatedAt: string;
  owner: Address;
  resolver: Address;
  treasury: Address;
  signalCount: number;
  signals: Signal[];
  summary: {
    activeSignals: number;
    slashedStakeUsdc: number;
    settledSignals: number;
    totalStakeUsdc: number;
  };
  walletBalanceUsdc?: number;
};

export function serializeDashboard(dashboard: OnchainDashboard): ChainState {
  return {
    agents: dashboard.agents,
    blockNumber: dashboard.blockNumber.toString(),
    contracts: {
      configured: contractsConfigured,
      demoUsdcAddress,
      signalBondAddress,
    },
    generatedAt: new Date().toISOString(),
    owner: dashboard.owner,
    resolver: dashboard.resolver,
    treasury: dashboard.treasury,
    signalCount: dashboard.signalCount,
    signals: dashboard.signals,
    summary: {
      activeSignals: dashboard.signals.filter((signal) => signal.status === "active").length,
      slashedStakeUsdc: dashboard.slashedStakeUsdc,
      settledSignals: dashboard.signals.filter((signal) => signal.status === "settled").length,
      totalStakeUsdc: dashboard.signals.reduce((sum, signal) => sum + signal.stakeUsdc, 0),
    },
    walletBalanceUsdc: dashboard.walletBalanceUsdc,
  };
}
