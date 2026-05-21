import { calculateScore } from "./reputation";
import type { Agent, Direction, Signal } from "./types";

export type ConsensusSide = "LONG" | "SHORT" | "YES" | "NO" | "MIXED";

export type ConsensusContributor = {
  agent: Agent;
  signal: Signal;
  reputation: number;
  weight: number;
  contribution: number;
  side: Direction;
};

export type MarketConsensus = {
  market: string;
  slug: string;
  signalCount: number;
  agentCount: number;
  side: ConsensusSide;
  agreementPct: number;
  weightedConfidenceBps: number;
  totalStake: number;
  weightedSum: number;
  totalWeight: number;
  contributors: ConsensusContributor[];
  lastUpdated: string;
};

export function slugifyMarket(market: string): string {
  return market
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sideForMarket(direction: Direction): { value: 1 | -1; isYesNo: boolean } {
  if (direction === "LONG") return { value: 1, isYesNo: false };
  if (direction === "SHORT") return { value: -1, isYesNo: false };
  if (direction === "YES") return { value: 1, isYesNo: true };
  return { value: -1, isYesNo: true };
}

export function computeMarketConsensus(
  market: string,
  signals: Signal[],
  agents: Agent[],
): MarketConsensus | null {
  const marketSignals = signals.filter((s) => s.market === market);
  if (marketSignals.length === 0) return null;

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  let weightedSum = 0;
  let totalWeight = 0;
  let weightedConfNumer = 0;
  let stakeSum = 0;
  const seenAgents = new Set<string>();
  let anyYesNo = false;
  const contributors: ConsensusContributor[] = [];
  let lastUpdatedMs = 0;

  for (const sig of marketSignals) {
    const agent = agentMap.get(sig.agentId);
    if (!agent) continue;
    seenAgents.add(agent.id);

    const { value: dirValue, isYesNo } = sideForMarket(sig.direction);
    if (isYesNo) anyYesNo = true;

    const reputation = Math.max(calculateScore(agent).reputation, 1);
    const conviction = sig.confidenceBps / 10_000;
    const weight = reputation * conviction;
    const contribution = weight * dirValue;

    weightedSum += contribution;
    totalWeight += weight;
    weightedConfNumer += sig.confidenceBps * reputation;
    stakeSum += sig.stakeUsdc;
    lastUpdatedMs = Math.max(lastUpdatedMs, new Date(sig.createdAt).getTime());

    contributors.push({
      agent,
      signal: sig,
      reputation,
      weight,
      contribution,
      side: sig.direction,
    });
  }

  contributors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const longSide: ConsensusSide = anyYesNo ? "YES" : "LONG";
  const shortSide: ConsensusSide = anyYesNo ? "NO" : "SHORT";
  const tieThreshold = 1e-6;

  let side: ConsensusSide;
  if (Math.abs(weightedSum) < tieThreshold) side = "MIXED";
  else if (weightedSum > 0) side = longSide;
  else side = shortSide;

  const agreementPct =
    totalWeight === 0
      ? 0
      : Math.min(100, Math.round((Math.abs(weightedSum) / totalWeight) * 100));

  const weightedConfidenceBps =
    totalWeight === 0
      ? 0
      : Math.round(weightedConfNumer / contributors.reduce((s, c) => s + c.reputation, 0));

  return {
    market,
    slug: slugifyMarket(market),
    signalCount: marketSignals.length,
    agentCount: seenAgents.size,
    side,
    agreementPct,
    weightedConfidenceBps,
    totalStake: stakeSum,
    weightedSum,
    totalWeight,
    contributors,
    lastUpdated: new Date(lastUpdatedMs).toISOString(),
  };
}

export function listMarketsWithConsensus(
  signals: Signal[],
  agents: Agent[],
): MarketConsensus[] {
  const uniqueMarkets = Array.from(new Set(signals.map((s) => s.market)));
  const consensuses: MarketConsensus[] = [];
  for (const market of uniqueMarkets) {
    const c = computeMarketConsensus(market, signals, agents);
    if (c) consensuses.push(c);
  }

  return consensuses.sort((a, b) => {
    if (a.signalCount !== b.signalCount) return b.signalCount - a.signalCount;
    return b.totalStake - a.totalStake;
  });
}
