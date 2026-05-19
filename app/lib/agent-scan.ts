import { keccak256, stringToHex, type Hex } from "viem";
import type { Direction } from "./types";

export type AgentScan = {
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
  sourceHash: Hex;
  generatedAt: string;
  expiresAt: string;
};

type ScanTemplate = Omit<AgentScan, "generatedAt" | "expiresAt" | "sourceHash"> & {
  signalWindowHours: number;
};

const templates: ScanTemplate[] = [
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
      "Gateway route quotes are stable while two venues imply stale USDC inventory. Expected spread clears settlement and route costs.",
    sources: ["gateway-quotes", "cex-depth", "arc-gas"],
    signalWindowHours: 18,
  },
  {
    agentId: "perp-warden",
    market: "BTC-PERP liquidation band",
    venue: "Perp venue basket",
    direction: "LONG",
    confidenceBps: 5900,
    stakeUsdc: 520,
    entryPrice: 106_420,
    targetPrice: 108_900,
    reasoning:
      "Liquidation density thinned below spot after forced selling. Funding reset and spot basis improved without a matching open-interest expansion.",
    sources: ["liquidation-map", "funding-reset", "basis-monitor"],
    signalWindowHours: 12,
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
      "Speech sentiment, terminal-rate pricing, and labor nowcasts favor policy patience. Market odds still discount a stale surprise path.",
    sources: ["fed-speech-embedding", "rates-curve", "labor-nowcast"],
    signalWindowHours: 36,
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
      "Euro liquidity improved into the London close while dollar funding premium softened. The agent expects session-level mean reversion.",
    sources: ["fx-liquidity", "basis-swap", "session-flow"],
    signalWindowHours: 24,
  },
  {
    agentId: "macro-sentinel",
    market: "ETH/BTC relative strength",
    venue: "Arc paper settlement",
    direction: "SHORT",
    confidenceBps: 6100,
    stakeUsdc: 440,
    entryPrice: 0.0462,
    targetPrice: 0.0448,
    reasoning:
      "ETH perpetual funding crowded faster than spot confirmation. BTC momentum remains cleaner against dollar liquidity and exchange reserve flows.",
    sources: ["funding-rate-scan", "exchange-reserves", "macro-calendar"],
    signalWindowHours: 24,
  },
  {
    agentId: "polymath-oracle",
    market: "US CPI above consensus",
    venue: "Prediction market",
    direction: "NO",
    confidenceBps: 5800,
    stakeUsdc: 360,
    entryPrice: 0.44,
    targetPrice: 0.37,
    reasoning:
      "Inflation nowcast dispersion narrowed while market depth still prices a surprise tail. Shelter and energy revisions reduce the upside setup.",
    sources: ["inflation-nowcast", "market-depth", "historical-surprise-set"],
    signalWindowHours: 30,
  },
];

export function generateAgentScan({
  expiresInSeconds,
  now = new Date(),
  salt = "signalbond-agent-scan",
  sequence = 0,
}: {
  expiresInSeconds?: number;
  now?: Date;
  salt?: string;
  sequence?: number;
} = {}): AgentScan {
  const template = templates[positiveModulo(sequence, templates.length)];
  const { signalWindowHours, ...signal } = template;
  const expiresAt = new Date(
    now.getTime() +
      (expiresInSeconds ?? signalWindowHours * 60 * 60) * 1000,
  );
  const sourcePayload = [
    salt,
    sequence,
    signal.agentId,
    signal.market,
    signal.direction,
    signal.confidenceBps,
    signal.stakeUsdc,
    signal.sources.join(","),
    now.toISOString(),
  ].join(":");

  return {
    ...signal,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sourceHash: keccak256(stringToHex(sourcePayload)),
  };
}

export function directionToContractValue(direction: Direction): number {
  switch (direction) {
    case "LONG":
      return 0;
    case "SHORT":
      return 1;
    case "YES":
      return 2;
    case "NO":
      return 3;
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
