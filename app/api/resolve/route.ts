import { NextResponse } from "next/server";
import { agents } from "../../lib/seed";
import { readOnchainDashboard } from "../../lib/onchain";
import { contractsConfigured } from "../../lib/contract";
import {
  isResolvable,
  resolveVerdict,
  type MarketQuote,
  type ResolutionVerdict,
} from "../../lib/resolver";
import {
  resolverAddress,
  resolverConfigured,
  resolverRoleAddresses,
  submitResolution,
} from "../../lib/resolver-server";
import {
  evaluateResolverExecuteAuth,
  hasResolverBearerAuth,
  hasResolverWalletAuthAttempt,
} from "../../lib/resolver-auth";
import { arcTxUrl } from "../../lib/explorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = {
  onchainId: number;
  signalId: string;
  market: string;
  agentId: string;
  direction: string;
  entryPrice: number;
  stakeUsdc: number;
  expiresAt: string;
  verdict: ResolutionVerdict;
  quote?: MarketQuote;
};

type Execution = Plan & {
  txHash: `0x${string}`;
  txUrl: string;
};

type Failure = {
  onchainId?: number;
  signalId?: string;
  error: string;
};

/**
 * GET — dry-run for anonymous dashboard previews, execute only for Vercel cron
 * requests carrying Authorization: Bearer ${CRON_SECRET}.
 * POST — execute for operator calls carrying either the same bearer secret or
 * a short-lived signature from the current contract owner/resolver wallet.
 *
 * Both routes are safe to call without RESOLVER_PRIVATE_KEY set; the executor
 * just returns dry-run results in that case so the UI can still show the plan.
 */

export async function GET(request: Request) {
  // Vercel crons can only fire GET, so bearer-authenticated cron requests
  // execute. Anonymous requests always remain dry-run previews unless they ask
  // for execute explicitly, in which case they receive an auth error.
  const url = new URL(request.url);
  const wantsExecute =
    url.searchParams.get("execute") === "1" || hasResolverBearerAuth(request);
  return handle(request, wantsExecute ? "execute" : "dry-run");
}

export async function POST(request: Request) {
  return handle(request, "execute");
}

async function handle(request: Request, mode: "dry-run" | "execute") {
  if (!contractsConfigured) {
    return NextResponse.json(
      { error: "SignalBond contract address is not configured." },
      { status: 503 },
    );
  }

  if (mode === "execute") {
    try {
      const needsWalletRoles =
        !hasResolverBearerAuth(request) && hasResolverWalletAuthAttempt(request);
      const authorizedAddresses = needsWalletRoles
        ? await resolverRoleAddresses()
        : undefined;
      const auth = await evaluateResolverExecuteAuth(request, { authorizedAddresses });
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `Resolver auth check failed: ${error.message}`
              : "Resolver auth check failed.",
        },
        { status: 500 },
      );
    }
  }

  try {
    const dashboard = await readOnchainDashboard(agents);
    const now = Date.now();
    const due = dashboard.signals.filter((s) => isResolvable(s, now));

    const plans: Plan[] = [];
    for (const signal of due) {
      const { verdict, quote } = await resolveVerdict(signal);
      plans.push({
        onchainId: signal.onchainId!,
        signalId: signal.id,
        market: signal.market,
        agentId: signal.agentId,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        stakeUsdc: signal.stakeUsdc,
        expiresAt: signal.expiresAt,
        verdict,
        quote,
      });
    }

    if (mode === "dry-run" || !resolverConfigured()) {
      return NextResponse.json({
        mode: mode === "execute" && !resolverConfigured() ? "dry-run-no-key" : "dry-run",
        resolver: resolverAddress(),
        evaluated: plans.length,
        plans,
      });
    }

    const executed: Execution[] = [];
    const failed: Failure[] = [];
    for (const plan of plans) {
      try {
        const txHash = await submitResolution(
          plan.onchainId,
          plan.verdict.correct,
          plan.verdict.pnlBps,
        );
        executed.push({ ...plan, txHash, txUrl: arcTxUrl(txHash) });
      } catch (error) {
        failed.push({
          onchainId: plan.onchainId,
          signalId: plan.signalId,
          error: error instanceof Error ? error.message : "resolveSignal failed",
        });
      }
    }

    return NextResponse.json({
      mode: "execute",
      resolver: resolverAddress(),
      evaluated: plans.length,
      executed,
      failed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resolver pass failed." },
      { status: 500 },
    );
  }
}
