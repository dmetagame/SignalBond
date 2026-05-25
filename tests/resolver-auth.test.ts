import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildResolverExecutionMessage } from "../app/lib/resolver-auth-message";
import {
  evaluateResolverExecuteAuth,
  hasResolverBearerAuth,
} from "../app/lib/resolver-auth";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
});

describe("resolver execution auth", () => {
  it("disables execution when CRON_SECRET is missing and no wallet auth is attempted", async () => {
    delete process.env.CRON_SECRET;

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve"),
    );

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      error: "Resolver execution is disabled because CRON_SECRET is not configured.",
    });
  });

  it("rejects public same-origin markers", async () => {
    process.env.CRON_SECRET = "resolver-secret";

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve", {
        headers: { "x-resolver-same-origin": "1" },
      }),
    );

    assert.deepEqual(result, { ok: false, status: 401, error: "Unauthorized" });
    assert.equal(
      hasResolverBearerAuth(
        new Request("https://signalbond.test/api/resolve", {
          headers: { "x-resolver-same-origin": "1" },
        }),
      ),
      false,
    );
  });

  it("accepts the bearer cron secret", async () => {
    process.env.CRON_SECRET = "resolver-secret";

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve", {
        headers: { authorization: "Bearer resolver-secret" },
      }),
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(
      hasResolverBearerAuth(
        new Request("https://signalbond.test/api/resolve", {
          headers: { authorization: "Bearer resolver-secret" },
        }),
      ),
      true,
    );
  });

  it("accepts a short-lived signature from an authorized resolver wallet", async () => {
    process.env.CRON_SECRET = "resolver-secret";
    const account = privateKeyToAccount(generatePrivateKey());
    const origin = "https://signalbond.test";
    const issuedAt = Date.now();
    const message = buildResolverExecutionMessage({ origin, issuedAt });
    const signature = await account.signMessage({ message });

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve", {
        headers: {
          "x-resolver-address": account.address,
          "x-resolver-signature": signature,
          "x-resolver-origin": origin,
          "x-resolver-issued-at": String(issuedAt),
          host: "signalbond.test",
        },
      }),
      { authorizedAddresses: [account.address], nowMs: issuedAt },
    );

    assert.deepEqual(result, { ok: true });
  });

  it("rejects spoofed same-origin headers even when origin matches host", async () => {
    process.env.CRON_SECRET = "resolver-secret";

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve", {
        headers: {
          "x-resolver-same-origin": "1",
          origin: "https://signalbond.test",
          host: "signalbond.test",
        },
      }),
    );

    assert.deepEqual(result, { ok: false, status: 401, error: "Unauthorized" });
  });

  it("rejects wallet signatures from non-role addresses", async () => {
    process.env.CRON_SECRET = "resolver-secret";
    const signer = privateKeyToAccount(generatePrivateKey());
    const role = privateKeyToAccount(generatePrivateKey());
    const origin = "https://signalbond.test";
    const issuedAt = Date.now();
    const message = buildResolverExecutionMessage({ origin, issuedAt });
    const signature = await signer.signMessage({ message });

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve", {
        headers: {
          "x-resolver-address": signer.address,
          "x-resolver-signature": signature,
          "x-resolver-origin": origin,
          "x-resolver-issued-at": String(issuedAt),
          host: "signalbond.test",
        },
      }),
      { authorizedAddresses: [role.address], nowMs: issuedAt },
    );

    assert.deepEqual(result, {
      ok: false,
      status: 401,
      error: "Connected wallet is not resolver or owner.",
    });
  });

  it("rejects expired resolver wallet signatures", async () => {
    process.env.CRON_SECRET = "resolver-secret";
    const account = privateKeyToAccount(generatePrivateKey());
    const origin = "https://signalbond.test";
    const issuedAt = Date.now() - 10 * 60_000;
    const message = buildResolverExecutionMessage({ origin, issuedAt });
    const signature = await account.signMessage({ message });

    const result = await evaluateResolverExecuteAuth(
      new Request("https://signalbond.test/api/resolve", {
        headers: {
          "x-resolver-address": account.address,
          "x-resolver-signature": signature,
          "x-resolver-origin": origin,
          "x-resolver-issued-at": String(issuedAt),
          host: "signalbond.test",
        },
      }),
      { authorizedAddresses: [account.address], nowMs: Date.now() },
    );

    assert.deepEqual(result, {
      ok: false,
      status: 401,
      error: "Resolver signature expired.",
    });
  });
});
