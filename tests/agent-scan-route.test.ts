import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET } from "../app/api/agent-scan/route";

describe("agent scan route runtime controls", () => {
  it("exposes deterministic fallback status when no LLM provider is configured", async () => {
    const response = await GET(
      new Request("https://signalbond.test/api/agent-scan?sequence=0", {
        headers: { "x-forwarded-for": "agent-scan-runtime-test" },
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.agentRuntime, "deterministic-scan-v1");
    assert.equal(body.provider, "seed");
    assert.equal(body.fallback, true);
    assert.equal(body.fallbackReason, "no-llm-provider-configured");
    assert.equal(body.signal.agentRuntime, "deterministic-scan-v1");
    assert.equal(response.headers.get("X-RateLimit-Limit"), "30");
  });

  it("rate limits repeated proposal requests per client key", async () => {
    let response: Response | undefined;
    for (let index = 0; index < 31; index += 1) {
      response = await GET(
        new Request(`https://signalbond.test/api/agent-scan?sequence=${index}`, {
          headers: { "x-forwarded-for": "agent-scan-rate-limit-test" },
        }),
      );
    }

    assert.equal(response?.status, 429);
    assert.equal(response?.headers.get("X-RateLimit-Remaining"), "0");
  });
});
