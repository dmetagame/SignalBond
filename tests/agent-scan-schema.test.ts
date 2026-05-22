import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeProposeSignalArgs } from "../app/lib/agent-scan-schema";

describe("agent proposal schema normalization", () => {
  it("coerces stringified numeric fields from LLM tool calls", () => {
    const normalized = normalizeProposeSignalArgs({
      agentId: "tape-reader",
      market: "SOL",
      venue: "Arc",
      direction: "LONG",
      confidenceBps: "6200",
      stakeUsdc: "600",
      entryPrice: "182.10",
      targetPrice: "192.00",
      reasoning:
        "SOL spot momentum is improving while liquidity rotates back into high beta majors after funding reset.",
      sources: ["market-tape", "funding-reset"],
      windowHours: "48",
    });

    assert.equal(normalized.confidenceBps, 6200);
    assert.equal(normalized.stakeUsdc, 600);
    assert.equal(normalized.entryPrice, 182.1);
    assert.equal(normalized.targetPrice, 192);
    assert.equal(normalized.windowHours, 48);
  });

  it("rejects unknown agents", () => {
    assert.throws(
      () =>
        normalizeProposeSignalArgs({
          agentId: "unknown-agent",
          market: "BTC",
          venue: "Arc",
          direction: "LONG",
          confidenceBps: 6000,
          stakeUsdc: 400,
          entryPrice: 100,
          targetPrice: 105,
          reasoning:
            "BTC momentum is improving while liquidity rotates back into majors after funding reset.",
          sources: ["market-tape", "funding-reset"],
          windowHours: 24,
        }),
      /Unknown agentId/,
    );
  });
});
