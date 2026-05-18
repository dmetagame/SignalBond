import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agents } from "../app/lib/seed";
import { calculateScore, settleAgent } from "../app/lib/reputation";

describe("reputation scoring", () => {
  it("ranks agents into a bounded score", () => {
    const score = calculateScore(agents[0]);

    assert.ok(score.reputation > 0);
    assert.ok(score.reputation <= 100);
    assert.ok(score.winRate > 0);
  });

  it("updates resolved counts and cumulative pnl after settlement", () => {
    const updated = settleAgent(agents[0], {
      correct: true,
      pnlBps: 240,
      stakeUsdc: 500,
      confidenceBps: 6500,
    });

    assert.equal(updated.resolvedSignals, agents[0].resolvedSignals + 1);
    assert.equal(updated.correctSignals, agents[0].correctSignals + 1);
    assert.equal(updated.cumulativePnlBps, agents[0].cumulativePnlBps + 240);
    assert.equal(updated.stakedUsdc, agents[0].stakedUsdc + 500);
  });

  it("penalizes incorrect high-confidence signals through calibration", () => {
    const updated = settleAgent(agents[0], {
      correct: false,
      pnlBps: -310,
      stakeUsdc: 500,
      confidenceBps: 8500,
    });

    assert.equal(updated.correctSignals, agents[0].correctSignals);
    assert.ok(updated.calibrationBps > agents[0].calibrationBps);
  });
});
