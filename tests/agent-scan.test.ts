import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directionToContractValue, generateAgentScan } from "../app/lib/agent-scan";

describe("agent scan generation", () => {
  it("produces a complete market signal with a stable bytes32 source hash", () => {
    const scan = generateAgentScan({
      now: new Date("2026-05-19T08:00:00.000Z"),
      sequence: 0,
    });

    assert.equal(scan.sourceHash.length, 66);
    assert.ok(scan.reasoning.length > 80);
    assert.ok(scan.sources.length >= 3);
    assert.ok(scan.expiresAt > scan.generatedAt);
  });

  it("maps directions into the contract enum order", () => {
    assert.equal(directionToContractValue("LONG"), 0);
    assert.equal(directionToContractValue("SHORT"), 1);
    assert.equal(directionToContractValue("YES"), 2);
    assert.equal(directionToContractValue("NO"), 3);
  });
});
