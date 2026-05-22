import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  evaluateResolverExecuteAuth,
  hasResolverBearerAuth,
} from "../app/lib/resolver-auth";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
});

describe("resolver execution auth", () => {
  it("disables execution when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;

    const result = evaluateResolverExecuteAuth(new Request("https://signalbond.test/api/resolve"));

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      error: "Resolver execution is disabled because CRON_SECRET is not configured.",
    });
  });

  it("rejects public same-origin markers", () => {
    process.env.CRON_SECRET = "resolver-secret";

    const result = evaluateResolverExecuteAuth(
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

  it("accepts only the bearer cron secret", () => {
    process.env.CRON_SECRET = "resolver-secret";

    const result = evaluateResolverExecuteAuth(
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
});
