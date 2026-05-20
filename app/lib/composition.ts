import type { Agent } from "./types";

export type AgentCategory = "Macro" | "Execution" | "Prediction" | "Arbitrage";

export type CompositionSegment = {
  category: AgentCategory;
  count: number;
  stake: number;
  color: string;
};

const CATEGORY_ORDER: AgentCategory[] = ["Macro", "Execution", "Prediction", "Arbitrage"];

const FALLBACK_COLOR: Record<AgentCategory, string> = {
  Macro: "#d4ff3e",
  Execution: "#65d6ff",
  Prediction: "#f5b84b",
  Arbitrage: "#ff8a5c",
};

export function categorizeDesk(desk: string): AgentCategory {
  const lower = desk.toLowerCase();
  if (lower.includes("macro")) return "Macro";
  if (lower.includes("predict")) return "Prediction";
  if (lower.includes("arb")) return "Arbitrage";
  return "Execution";
}

export function computeComposition(agents: Agent[]): {
  segments: CompositionSegment[];
  totalAgents: number;
  totalStake: number;
} {
  const buckets = new Map<AgentCategory, CompositionSegment>();
  for (const agent of agents) {
    const category = categorizeDesk(agent.desk);
    const existing = buckets.get(category);
    if (existing) {
      existing.count += 1;
      existing.stake += agent.stakedUsdc;
    } else {
      buckets.set(category, {
        category,
        count: 1,
        stake: agent.stakedUsdc,
        color: agent.color || FALLBACK_COLOR[category],
      });
    }
  }

  const segments = CATEGORY_ORDER.flatMap((cat) => {
    const seg = buckets.get(cat);
    return seg ? [seg] : [];
  });

  return {
    segments,
    totalAgents: agents.length,
    totalStake: agents.reduce((sum, a) => sum + a.stakedUsdc, 0),
  };
}
