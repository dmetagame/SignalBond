"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  TimerReset,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom } from "viem";
import SectionHeader from "../../components/dashboard/SectionHeader";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import { arcCanteen } from "../../lib/contract";
import { arcAddressUrl, arcTxUrl } from "../../lib/explorer";
import { formatBps } from "../../lib/reputation";
import { buildResolverExecutionMessage } from "../../lib/resolver-auth-message";

type Plan = {
  onchainId: number;
  signalId: string;
  market: string;
  agentId: string;
  direction: string;
  entryPrice: number;
  stakeUsdc: number;
  expiresAt: string;
  verdict: {
    correct: boolean;
    pnlBps: number;
    exitPrice: number;
    reasoning: string;
  };
  quote?: {
    symbol: string;
    price: number;
    source: string;
    fetchedAt: string;
    observedAt: string;
    proofUrl: string;
    method: "historical-range" | "spot";
  };
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

type ResolverPayload = {
  mode: "dry-run" | "dry-run-no-key" | "execute";
  resolver?: `0x${string}`;
  evaluated: number;
  plans?: Plan[];
  executed?: Execution[];
  failed?: Failure[];
};

export default function ResolverPage() {
  const {
    agents,
    refreshChainState,
    walletAddress,
    connectWallet,
    resolverAddress,
    ownerAddress,
  } = useDashboard();
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const [payload, setPayload] = useState<ResolverPayload | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [lastRunAt, setLastRunAt] = useState<string | undefined>();
  const walletAuthorized =
    Boolean(walletAddress) &&
    [resolverAddress, ownerAddress].some(
      (address) => address?.toLowerCase() === walletAddress?.toLowerCase(),
    );

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/resolve", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
        throw new Error(body?.error ?? `Resolver preview failed (${res.status}).`);
      }
      const json = (await res.json()) as ResolverPayload;
      setPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolver preview failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const runResolution = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (!walletAddress) {
        await connectWallet();
        throw new Error(
          "Wallet connected. Click Resolve again to sign the resolver authorization.",
        );
      }

      if (!walletAuthorized) {
        throw new Error("Connect the contract resolver or owner wallet to run the resolver.");
      }

      if (!window.ethereum) {
        throw new Error("No injected wallet found.");
      }

      const origin = window.location.origin;
      const issuedAt = Date.now();
      const message = buildResolverExecutionMessage({ origin, issuedAt });
      const walletClient = createWalletClient({
        account: walletAddress,
        chain: arcCanteen,
        transport: custom(window.ethereum),
      });
      const signature = await walletClient.signMessage({
        account: walletAddress,
        message,
      });

      const res = await fetch("/api/resolve", {
        method: "POST",
        cache: "no-store",
        headers: {
          "x-resolver-address": walletAddress,
          "x-resolver-signature": signature,
          "x-resolver-origin": origin,
          "x-resolver-issued-at": String(issuedAt),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
        throw new Error(body?.error ?? `Resolver run failed (${res.status}).`);
      }
      const json = (await res.json()) as ResolverPayload;
      setPayload(json);
      setLastRunAt(new Date().toISOString());
      void refreshChainState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolver run failed.");
    } finally {
      setBusy(false);
    }
  }, [connectWallet, refreshChainState, walletAddress, walletAuthorized]);

  const plans = payload?.plans ?? [];
  const executed = payload?.executed ?? [];
  const failed = payload?.failed ?? [];
  const dueCount = plans.length || executed.length;
  const mode = payload?.mode;
  const resolverRoleReady = mode !== undefined && mode !== "dry-run-no-key";
  const canExecute = resolverRoleReady && (!walletAddress || walletAuthorized);
  const executeTitle = !resolverRoleReady
    ? "Set RESOLVER_PRIVATE_KEY in Vercel env to enable execution"
    : walletAddress && !walletAuthorized
      ? "Connected wallet is not the contract resolver or owner"
      : !walletAddress
        ? "Connect the contract resolver or owner wallet"
        : dueCount === 0
          ? "No expired signals to resolve"
          : undefined;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Auto-resolver"
        subtitle="Closes the loop: scans expired signals, fetches expiry-time price evidence from CoinGecko when available, and writes the verdict back onchain."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchPlan}
              disabled={loading || busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-muted hover:text-text disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={1.75} />
              Refresh plan
            </button>
            <button
              type="button"
              onClick={runResolution}
              disabled={loading || busy || dueCount === 0 || !canExecute}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
              title={executeTitle}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
              ) : (
                <Gavel className="size-3.5" strokeWidth={2.5} />
              )}
              {!walletAddress
                ? "Connect resolver wallet"
                : `Resolve ${dueCount > 0 ? `${dueCount} signal${dueCount === 1 ? "" : "s"}` : "now"}`}
            </button>
          </div>
        }
      />

      <StatusBanner
        mode={mode}
        resolver={payload?.resolver}
        lastRunAt={lastRunAt}
        executedCount={executed.length}
        failedCount={failed.length}
      />

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {executed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            <CheckCircle2 className="size-3.5 text-success" strokeWidth={2} />
            Just resolved
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {executed.map((exec) => (
              <ResolutionCard
                key={exec.onchainId}
                plan={exec}
                executed
                agentName={agentMap.get(exec.agentId)?.name}
              />
            ))}
          </div>
        </section>
      )}

      {failed.length > 0 && (
        <section className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="size-4" strokeWidth={2} />
            {failed.length} resolution{failed.length === 1 ? "" : "s"} failed
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {failed.map((f, idx) => (
              <li key={`${f.onchainId ?? f.signalId ?? idx}-${idx}`}>
                #{f.onchainId ?? f.signalId} — {f.error}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
          <TimerReset className="size-3.5" strokeWidth={2} />
          Expired &amp; awaiting resolution
        </div>
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-line bg-panel py-16 text-sm text-muted">
            <Loader2 className="mr-2 size-4 animate-spin" strokeWidth={2} />
            Loading expired signals…
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-soft bg-panel-muted/40 px-6 py-16 text-center">
            <Gavel className="size-6 text-faint" strokeWidth={1.75} />
            <div className="text-sm font-semibold text-text">Nothing due</div>
            <p className="max-w-md text-xs text-muted">
              All onchain signals are either still active or already resolved. Run an agent cycle
              with a short expiry to populate this queue.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <ResolutionCard
                key={plan.onchainId}
                plan={plan}
                executed={false}
                agentName={agentMap.get(plan.agentId)?.name}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBanner({
  mode,
  resolver,
  lastRunAt,
  executedCount,
  failedCount,
}: {
  mode?: ResolverPayload["mode"];
  resolver?: `0x${string}`;
  lastRunAt?: string;
  executedCount: number;
  failedCount: number;
}) {
  if (!mode) return null;
  const isExecute = mode === "execute";
  const noKey = mode === "dry-run-no-key";

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-panel p-5 shadow-card md:grid-cols-4">
      <Stat
        label="Mode"
        value={
          isExecute ? "Execute" : noKey ? "Dry-run (no key)" : "Dry-run"
        }
        tone={isExecute ? "accent" : noKey ? "danger" : "muted"}
      />
      <Stat
        label="Resolver"
        value={
          resolver ? (
            <Link
              href={arcAddressUrl(resolver)}
              target="_blank"
              className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
            >
              {`${resolver.slice(0, 6)}…${resolver.slice(-4)}`}
              <ExternalLink className="size-3" strokeWidth={2} />
            </Link>
          ) : (
            "—"
          )
        }
      />
      <Stat
        label="Last run"
        value={lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : "—"}
      />
      <Stat
        label="Outcome"
        value={
          executedCount + failedCount === 0
            ? "—"
            : `${executedCount} ok · ${failedCount} failed`
        }
        tone={failedCount > 0 ? "danger" : executedCount > 0 ? "accent" : "muted"}
      />
    </section>
  );
}

function ResolutionCard({
  plan,
  executed,
  agentName,
}: {
  plan: Plan | Execution;
  executed: boolean;
  agentName?: string;
}) {
  const correct = plan.verdict.correct;
  const Icon = correct ? ArrowUpRight : ArrowDownRight;
  const toneClass = correct ? "text-success" : "text-danger";
  const exec = executed ? (plan as Execution) : undefined;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wider text-faint">
            #{plan.onchainId} · {agentName ?? plan.agentId}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-text">{plan.market}</div>
          <div className="text-[11px] text-muted">
            {plan.direction} · stake ${plan.stakeUsdc.toLocaleString()} · expired{" "}
            {new Date(plan.expiresAt).toLocaleString()}
          </div>
        </div>
        <span
          className={[
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums",
            correct
              ? "bg-success/15 text-success"
              : "bg-danger/15 text-danger",
          ].join(" ")}
        >
          <Icon className="size-3" strokeWidth={2.25} />
          {formatBps(plan.verdict.pnlBps)}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Mini label="Entry" value={plan.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
        <Mini
          label="Exit"
          value={plan.verdict.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          tone={toneClass}
        />
        <Mini
          label="Source"
          value={plan.quote ? plan.quote.source : "deterministic"}
        />
        <Mini
          label="Observed"
          value={
            plan.quote
              ? new Date(plan.quote.observedAt).toLocaleTimeString()
              : "source hash"
          }
        />
      </div>

      <p className="text-[11px] leading-relaxed text-muted">{plan.verdict.reasoning}</p>

      {plan.quote?.proofUrl && (
        <Link
          href={plan.quote.proofUrl}
          target="_blank"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-line-soft bg-panel-muted px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text"
        >
          Quote proof
          <ExternalLink className="size-3" strokeWidth={2} />
        </Link>
      )}

      {exec && (
        <Link
          href={exec.txUrl}
          target="_blank"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent-strong hover:text-accent-foreground"
        >
          View tx on Arcscan
          <ExternalLink className="size-3" strokeWidth={2} />
        </Link>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "accent" | "danger" | "muted";
}) {
  const toneClass =
    tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "text-text";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-faint">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line-soft bg-panel-muted/40 p-2">
      <span className="text-[9px] font-medium uppercase tracking-wider text-faint">{label}</span>
      <span className={`font-mono text-xs tabular-nums ${tone ?? "text-text"}`}>{value}</span>
    </div>
  );
}
