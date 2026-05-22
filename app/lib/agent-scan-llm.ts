import Anthropic from "@anthropic-ai/sdk";
import { keccak256, stringToHex } from "viem";
import type { AgentScan } from "./agent-scan";
import {
  normalizeProposeSignalArgs,
  proposeSignalParameters,
  type ProposeSignalArgs,
} from "./agent-scan-schema";
import { agents as seedAgents, marketTape } from "./seed";

const MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_WINDOW_SECONDS = 24 * 60 * 60;

const SYSTEM_PROMPT = `You are SignalBond's market signals desk. You propose accountable trade ideas published by one of four AI market agents onto Arc, a stablecoin-native L1 by Circle. Every call is staked in USDC and resolved against an objective outcome. Reputation depends on calibration, so propose ideas you would defend.

You MUST call the proposeSignal tool exactly once. Pick the agent whose desk most naturally fits the highest-conviction idea right now. The reasoning string is the most important field — it should read like a one-paragraph desk memo, name the mechanism, and avoid generic platitudes.

Stay within the agents' existing markets where possible. Confidence is in basis points (0–10000). Stake is in USDC between 200 and 800. Entry and target prices should match the market quoted in the tape when applicable.`;

const AGENT_ROSTER_BLOCK = `Agent roster:\n${seedAgents
  .map(
    (a) =>
      `- id="${a.id}" handle="${a.handle}" desk="${a.desk}" risk=${a.risk} markets=[${a.markets.join(", ")}]\n  thesis: ${a.thesis}`,
  )
  .join("\n")}`;

const proposeSignalTool: Anthropic.Tool = {
  name: "proposeSignal",
  description: "Publish a single accountable market signal as one of the four SignalBond agents.",
  input_schema: proposeSignalParameters as unknown as Anthropic.Tool["input_schema"],
};

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function generateAgentScanWithLlm({
  sequence = 0,
  expiresInSeconds,
  now = new Date(),
  signal,
}: {
  sequence?: number;
  expiresInSeconds?: number;
  now?: Date;
  signal?: AbortSignal;
} = {}): Promise<AgentScan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic();

  const tape = marketTape
    .map((t) => `${t.symbol} ${t.price} (${t.change})`)
    .join(", ");

  const message = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 600,
      tool_choice: { type: "tool", name: "proposeSignal" },
      tools: [proposeSignalTool],
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: AGENT_ROSTER_BLOCK,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Current market tape: ${tape}.\nGenerate a fresh accountable signal (sequence ${sequence}). Avoid repeating the same market two sequences in a row. Keep the reasoning specific and defensible.`,
        },
      ],
    },
    { signal },
  );

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse || toolUse.name !== "proposeSignal") {
    throw new Error("LLM did not call proposeSignal.");
  }

  const args: ProposeSignalArgs = normalizeProposeSignalArgs(toolUse.input);

  const generatedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() +
      (expiresInSeconds ?? Math.max(1, args.windowHours) * 60 * 60) * 1000,
  ).toISOString();

  const sourcePayload = [
    "signalbond-llm-scan",
    sequence,
    args.agentId,
    args.market,
    args.direction,
    args.confidenceBps,
    args.stakeUsdc,
    args.sources.join(","),
    generatedAt,
  ].join(":");

  return {
    agentId: args.agentId,
    market: args.market,
    venue: args.venue,
    direction: args.direction,
    confidenceBps: args.confidenceBps,
    stakeUsdc: args.stakeUsdc,
    entryPrice: args.entryPrice,
    targetPrice: args.targetPrice,
    reasoning: args.reasoning.trim(),
    sources: args.sources,
    sourceHash: keccak256(stringToHex(sourcePayload)),
    generatedAt,
    expiresAt,
  };
}

export { DEFAULT_WINDOW_SECONDS };
