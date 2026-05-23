export type Direction = "LONG" | "SHORT" | "YES" | "NO";

export type Agent = {
  id: string;
  name: string;
  handle: string;
  desk: string;
  thesis: string;
  risk: "Conservative" | "Balanced" | "Aggressive";
  color: string;
  markets: string[];
  followers: number;
  stakedUsdc: number;
  resolvedSignals: number;
  correctSignals: number;
  cumulativePnlBps: number;
  calibrationBps: number;
  maxDrawdownBps: number;
  avgLatencySec: number;
};

export type SignalStatus = "active" | "settled";

export type Signal = {
  id: string;
  onchainId?: number;
  agentId: string;
  market: string;
  venue: string;
  direction: Direction;
  confidenceBps: number;
  stakeUsdc: number;
  entryPrice: number;
  targetPrice: number;
  createdAt: string;
  expiresAt: string;
  status: SignalStatus;
  pnlBps?: number;
  correct?: boolean;
  sourceHash: `0x${string}`;
  txHash: `0x${string}`;
  settlementTxHash?: `0x${string}`;
  publisher?: `0x${string}`;
  reasoning: string;
  sources: string[];
};

export type ScoreBreakdown = {
  winRate: number;
  pnlScore: number;
  calibrationScore: number;
  stakeScore: number;
  reputation: number;
};

export type WalletStatus = {
  address?: `0x${string}`;
  error?: string;
  lastTx?: `0x${string}`;
};
