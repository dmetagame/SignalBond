import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeError } from "../app/lib/dashboard-actions";

describe("dashboard action errors", () => {
  it("redacts Arc RPC endpoints and tokens from wallet-facing errors", () => {
    const message = normalizeError(
      new Error(
        "HTTP request failed. URL: https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_example_token Details: Failed to fetch",
      ),
    );

    assert.ok(!message.includes("swrm_example_token"));
    assert.ok(!message.includes("rpc.testnet.arc-node.thecanteenapp.com/v1/"));
    assert.match(message, /\[Arc RPC endpoint\]/);
  });
});
