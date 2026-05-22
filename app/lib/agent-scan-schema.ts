import { agents as seedAgents } from "./seed";
import type { Direction } from "./types";

export type ProposeSignalArgs = {
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
  windowHours: number;
};

const directions = ["LONG", "SHORT", "YES", "NO"] as const;
const agentIds = new Set(seedAgents.map((agent) => agent.id));

const integerOrString = (minimum: number, maximum: number, description: string) => ({
  anyOf: [
    { type: "integer", minimum, maximum },
    { type: "string", pattern: "^[0-9]+$" },
  ],
  description,
});

const numberOrString = (description: string) => ({
  anyOf: [
    { type: "number" },
    { type: "string", pattern: "^[0-9]+(\\.[0-9]+)?$" },
  ],
  description,
});

export const proposeSignalParameters = {
  type: "object",
  additionalProperties: false,
  required: [
    "agentId",
    "market",
    "venue",
    "direction",
    "confidenceBps",
    "stakeUsdc",
    "entryPrice",
    "targetPrice",
    "reasoning",
    "sources",
    "windowHours",
  ],
  properties: {
    agentId: {
      type: "string",
      enum: seedAgents.map((agent) => agent.id),
      description: "Which agent is publishing this call.",
    },
    market: { type: "string", description: "Short label for the market or contract." },
    venue: { type: "string", description: "Where the trade settles or quotes from." },
    direction: {
      type: "string",
      enum: directions,
      description: "Side of the call.",
    },
    confidenceBps: integerOrString(1, 10_000, "Conviction in basis points."),
    stakeUsdc: integerOrString(200, 800, "Stake in whole USDC."),
    entryPrice: numberOrString("Entry price for the position."),
    targetPrice: numberOrString("Target/payoff price."),
    reasoning: {
      type: "string",
      minLength: 60,
      maxLength: 600,
      description: "One-paragraph desk memo explaining the call.",
    },
    sources: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 5,
      description: "Short data-source tags the agent leaned on.",
    },
    windowHours: integerOrString(1, 96, "How long the signal stays open before resolution."),
  },
} as const;

export function normalizeProposeSignalArgs(input: unknown): ProposeSignalArgs {
  const record = asRecord(input);
  const agentId = readString(record, "agentId");
  if (!agentIds.has(agentId)) {
    throw new Error(`Unknown agentId: ${agentId}`);
  }

  return {
    agentId,
    market: readString(record, "market"),
    venue: readString(record, "venue"),
    direction: readDirection(record),
    confidenceBps: readInteger(record, "confidenceBps", 1, 10_000),
    stakeUsdc: readInteger(record, "stakeUsdc", 200, 800),
    entryPrice: readNumber(record, "entryPrice", 0),
    targetPrice: readNumber(record, "targetPrice", 0),
    reasoning: readString(record, "reasoning", 60, 600),
    sources: readSources(record),
    windowHours: readInteger(record, "windowHours", 1, 96),
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("proposeSignal arguments must be an object.");
  }
  return input as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  minLength = 1,
  maxLength = 1_000,
): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new Error(`${key} length is out of range.`);
  }
  return trimmed;
}

function readDirection(record: Record<string, unknown>): Direction {
  const value = readString(record, "direction");
  if (!directions.includes(value as Direction)) {
    throw new Error(`Unsupported direction: ${value}`);
  }
  return value as Direction;
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number {
  const value = readNumber(record, key, min, max);
  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer.`);
  }
  return value;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const raw = record[key];
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.trim().replaceAll(",", "").replace(/^\$/, ""))
        : Number.NaN;

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} is out of range.`);
  }
  return value;
}

function readSources(record: Record<string, unknown>): string[] {
  const value = record.sources;
  if (!Array.isArray(value)) {
    throw new Error("sources must be an array.");
  }
  const sources = value
    .filter((source): source is string => typeof source === "string")
    .map((source) => source.trim())
    .filter(Boolean);

  if (sources.length < 2 || sources.length > 5) {
    throw new Error("sources length is out of range.");
  }
  return sources;
}
