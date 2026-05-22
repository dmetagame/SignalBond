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
  submitResolution,
} from "../../lib/resolver-server";
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
 * GET — dry-run: returns the resolver's plan (which signals it would resolve and how)
 * POST — execute: submits resolveSignal transactions for each planned outcome
 *
 * Both routes are safe to call without RESOLVER_PRIVATE_KEY set; the executor
 * just returns dry-run results in that case so the UI can still show the plan.
 */

export async function GET(request: Request) {
  // Vercel crons can only fire GET, so the cron path needs to execute on GET.
  // We distinguish operator/cron calls from anonymous dashboard previews by
  // either the Bearer secret or an explicit `?execute=1` flag.
  const url = new URL(request.url);
  const wantsExecute =
    url.searchParams.get("execute") === "1" || isCronAuthorized(request);
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
    const authError = checkCronAuth(request);
    if (authError) return authError;
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

/**
 * Vercel cron requests include `Authorization: Bearer ${CRON_SECRET}` when
 * `CRON_SECRET` is set in project env. Require the header in production once
 * the secret is provisioned; the dashboard's manual "Resolve now" button
 * passes the same-origin marker so curious visitors can still preview/execute
 * locally during development.
 */
function checkCronAuth(request: Request): NextResponse | undefined {
  if (isCronAuthorized(request)) return undefined;
  if (!process.env.CRON_SECRET) return undefined;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const sameOrigin = request.headers.get("x-resolver-same-origin");
  return sameOrigin === "1";
}
