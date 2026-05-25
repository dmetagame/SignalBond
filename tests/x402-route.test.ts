import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET } from "../app/api/x402/signal-pack/route";

const originalFacilitatorUrl = process.env.X402_FACILITATOR_URL;
const signedPaymentHeader =
  "eyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1OjUwNDIwMDIiLCJwYXlsb2FkIjp7ImF1dGhvcml6YXRpb24iOnsiZnJvbSI6IjB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCJ9fX0=";

afterEach(() => {
  process.env.X402_FACILITATOR_URL = originalFacilitatorUrl;
});

describe("x402 signal pack route", () => {
  it("emits a 402 payment challenge before a payment payload is signed", async () => {
    const response = await GET(new Request("https://signalbond.test/api/x402/signal-pack"));

    assert.equal(response.status, 402);
    assert.ok(response.headers.get("PAYMENT-REQUIRED"));
  });

  it("keeps paid content locked when no facilitator is configured", async () => {
    delete process.env.X402_FACILITATOR_URL;

    const response = await GET(
      new Request("https://signalbond.test/api/x402/signal-pack", {
        headers: { "PAYMENT-SIGNATURE": signedPaymentHeader },
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(response.headers.get("X-SignalBond-X402-Mode"), "facilitator-pending");
    assert.equal(response.headers.get("PAYMENT-RESPONSE"), null);
    assert.equal(body.mode, "facilitator-pending");
    assert.equal(body.paidContent, "locked");
  });
});
