import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { buildResolverExecutionMessage } from "./resolver-auth-message";

type ResolverAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

type ResolverAuthOptions = {
  authorizedAddresses?: Address[];
  nowMs?: number;
};

const RESOLVER_AUTH_WINDOW_MS = 5 * 60_000;

export function hasResolverBearerAuth(request: Request): boolean {
  const secret = readCronSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export function hasResolverWalletAuthAttempt(request: Request): boolean {
  return Boolean(
    request.headers.get("x-resolver-address") ||
      request.headers.get("x-resolver-signature") ||
      request.headers.get("x-resolver-origin") ||
      request.headers.get("x-resolver-issued-at"),
  );
}

export async function evaluateResolverExecuteAuth(
  request: Request,
  options: ResolverAuthOptions = {},
): Promise<ResolverAuthResult> {
  if (hasResolverBearerAuth(request)) {
    return { ok: true };
  }

  const walletAuth = await evaluateResolverWalletAuth(request, options);
  if (walletAuth.attempted) {
    return walletAuth.result;
  }

  const secret = readCronSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Resolver execution is disabled because CRON_SECRET is not configured.",
    };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

function readCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || undefined;
}

async function evaluateResolverWalletAuth(
  request: Request,
  options: ResolverAuthOptions,
): Promise<{ attempted: boolean; result: ResolverAuthResult }> {
  const attempted = hasResolverWalletAuthAttempt(request);

  if (!attempted) {
    return { attempted: false, result: { ok: false, status: 401, error: "Unauthorized" } };
  }

  const address = request.headers.get("x-resolver-address");
  const signature = request.headers.get("x-resolver-signature");
  const origin = request.headers.get("x-resolver-origin");
  const issuedAtRaw = request.headers.get("x-resolver-issued-at");

  if (!address || !signature || !origin || !issuedAtRaw || !isAddress(address)) {
    return { attempted: true, result: { ok: false, status: 401, error: "Unauthorized" } };
  }

  if (!originMatchesHost(request, origin)) {
    return { attempted: true, result: { ok: false, status: 401, error: "Unauthorized" } };
  }

  const issuedAt = Number(issuedAtRaw);
  const nowMs = options.nowMs ?? Date.now();
  if (
    !Number.isFinite(issuedAt) ||
    Math.abs(nowMs - issuedAt) > RESOLVER_AUTH_WINDOW_MS
  ) {
    return {
      attempted: true,
      result: { ok: false, status: 401, error: "Resolver signature expired." },
    };
  }

  const authorized = options.authorizedAddresses ?? [];
  if (
    !authorized.some((candidate) => candidate.toLowerCase() === address.toLowerCase())
  ) {
    return {
      attempted: true,
      result: { ok: false, status: 401, error: "Connected wallet is not resolver or owner." },
    };
  }

  const message = buildResolverExecutionMessage({ origin, issuedAt });
  const verified = await verifyResolverMessage(address, message, signature);

  return {
    attempted: true,
    result: verified ? { ok: true } : { ok: false, status: 401, error: "Unauthorized" },
  };
}

function originMatchesHost(request: Request, origin: string): boolean {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function verifyResolverMessage(
  address: Address,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    return await verifyMessage({
      address,
      message,
      signature: signature as Hex,
    });
  } catch {
    return false;
  }
}
