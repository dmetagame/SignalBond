type ResolverAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function hasResolverBearerAuth(request: Request): boolean {
  const secret = readCronSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export function evaluateResolverExecuteAuth(request: Request): ResolverAuthResult {
  const secret = readCronSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Resolver execution is disabled because CRON_SECRET is not configured.",
    };
  }

  if (request.headers.get("authorization") === `Bearer ${secret}`) {
    return { ok: true };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

function readCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || undefined;
}
