import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  fetchMarketQuote,
  judgeOutcome,
  resolveVerdict,
} from "../app/lib/resolver";
import type { Signal } from "../app/lib/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("resolver price evidence", () => {
  it("uses the closest CoinGecko historical point around expiry", async () => {
    const expiry = new Date("2026-05-22T12:00:00.000Z");
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      assert.match(url, /market_chart\/range/);
      return Response.json({
        prices: [
          [expiry.getTime() - 60_000, 101],
          [expiry.getTime() + 15_000, 103],
          [expiry.getTime() + 90_000, 105],
        ],
      });
    };

    const quote = await fetchMarketQuote("BTC", expiry);

    assert.equal(quote?.price, 103);
    assert.equal(quote?.source, "coingecko:historical");
    assert.equal(quote?.method, "historical-range");
    assert.equal(quote?.observedAt, "2026-05-22T12:00:15.000Z");
  });

  it("falls back to spot quote when the historical range is unavailable", async () => {
    let calls = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      calls += 1;
      const url = String(input);
      if (url.includes("market_chart/range")) {
        return new Response("upstream unavailable", { status: 503 });
      }
      assert.match(url, /simple\/price/);
      return Response.json({ bitcoin: { usd: 107_500 } });
    };

    const quote = await fetchMarketQuote("BTC", new Date("2026-05-22T12:00:00.000Z"));

    assert.equal(calls, 2);
    assert.equal(quote?.price, 107_500);
    assert.equal(quote?.source, "coingecko:spot-fallback");
    assert.equal(quote?.method, "spot");
  });

  it("judges outcomes from the quote used for settlement", async () => {
    const signal = makeSignal({
      direction: "LONG",
      entryPrice: 100,
      targetPrice: 105,
      expiresAt: "2026-05-22T12:00:00.000Z",
    });
    globalThis.fetch = async () =>
      Response.json({ prices: [[new Date(signal.expiresAt).getTime(), 104]] });

    const { verdict, quote } = await resolveVerdict(signal);

    assert.equal(quote?.price, 104);
    assert.equal(verdict.correct, true);
    assert.equal(verdict.pnlBps, 400);
    assert.match(verdict.reasoning, /coingecko:historical/);
  });

  it("keeps short-call PnL signed by direction", () => {
    const signal = makeSignal({ direction: "SHORT", entryPrice: 100, targetPrice: 95 });
    const verdict = judgeOutcome(signal, 94);

    assert.equal(verdict.correct, true);
    assert.equal(verdict.pnlBps, 600);
  });
});

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "test-signal",
    onchainId: 1,
    agentId: "macro-sentinel",
    market: "BTC",
    venue: "Arc settlement",
    direction: "LONG",
    confidenceBps: 6500,
    stakeUsdc: 10,
    entryPrice: 100,
    targetPrice: 105,
    createdAt: "2026-05-22T11:00:00.000Z",
    expiresAt: "2026-05-22T12:00:00.000Z",
    status: "active",
    sourceHash: "0x52d6c85ce76b77d8451c8f51a24808f296b6566dbf2c4c4dce20325f646a5907",
    txHash: "0x448138efce2cdb7c1ab35d8267ebf7f958f29ec74948c789f320f677745e9951",
    reasoning: "Test signal.",
    sources: ["test"],
    ...overrides,
  };
}
