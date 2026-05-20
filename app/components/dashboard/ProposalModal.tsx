"use client";

import { ArrowRight, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { useDashboard, type PublishStage } from "./DashboardProvider";
import { shortHash } from "../../lib/dashboard-actions";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const stageLabel: Record<PublishStage, string> = {
  idle: "Publish to Arc",
  approving: "Approving USDC…",
  publishing: "Confirm publish in your wallet…",
  confirming: "Awaiting confirmation…",
};

export default function ProposalModal() {
  const {
    agentProposal,
    agents,
    publishStage,
    busy,
    walletAddress,
    publishProposal,
    dismissProposal,
  } = useDashboard();

  useEffect(() => {
    if (!agentProposal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissProposal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agentProposal, dismissProposal]);

  if (!agentProposal) return null;

  const agent = agents.find((a) => a.id === agentProposal.agentId);
  const publishing = busy.onchain || publishStage !== "idle";
  const label = stageLabel[publishStage] ?? "Publish to Arc";
  const needsWallet = !walletAddress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={publishing ? undefined : dismissProposal}
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(212,255,62,0.45), rgba(212,255,62,0.05) 60%, transparent 80%)",
          }}
        />

        <header className="relative flex items-start justify-between gap-3 border-b border-line-soft px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Sparkles className="size-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text">Agent Proposal</h2>
              <p className="text-xs text-muted">
                Generated {new Date(agentProposal.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissProposal}
            disabled={publishing}
            aria-label="Close"
            className="rounded-lg p-1.5 text-faint hover:bg-panel-muted hover:text-muted disabled:opacity-40"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="relative flex flex-col gap-5 px-6 py-5">
          {agent && (
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 items-center justify-center rounded-lg text-sm font-semibold uppercase"
                style={{
                  backgroundColor: `${agent.color}22`,
                  color: agent.color,
                  border: `1px solid ${agent.color}55`,
                }}
              >
                {agent.handle.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">{agent.name}</div>
                <div className="text-xs text-muted">{agent.desk}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Market" value={agentProposal.market} />
            <Stat label="Side" value={agentProposal.direction} mono />
            <Stat
              label="Confidence"
              value={`${(agentProposal.confidenceBps / 100).toFixed(0)}%`}
              mono
            />
            <Stat label="Stake" value={usd(agentProposal.stakeUsdc)} mono />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-panel-muted px-3 py-2 text-sm text-muted">
            <span className="tabular-nums">{agentProposal.entryPrice}</span>
            <ArrowRight className="size-3 text-faint" strokeWidth={2} />
            <span className="tabular-nums text-text">{agentProposal.targetPrice}</span>
            <span className="ml-auto text-[11px] text-faint">
              expires {new Date(agentProposal.expiresAt).toLocaleString()}
            </span>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Reasoning
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {agentProposal.reasoning}
            </p>
          </div>

          {agentProposal.sources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {agentProposal.sources.map((src) => (
                <span
                  key={src}
                  className="rounded-md border border-line-soft bg-panel-muted px-2 py-0.5 text-[11px] text-muted"
                >
                  {src}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-faint">
            <span>
              source hash <code className="font-mono">{shortHash(agentProposal.sourceHash)}</code>
            </span>
          </div>
        </div>

        <footer className="relative flex items-center justify-between gap-3 border-t border-line-soft bg-panel-muted/50 px-6 py-4">
          {needsWallet ? (
            <span className="text-xs text-muted">Connect a wallet to publish onchain.</span>
          ) : (
            <span className="text-xs text-muted">{label}</span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dismissProposal}
              disabled={publishing}
              className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-muted hover:text-text disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={publishProposal}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
            >
              {publishing ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
              ) : (
                <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
              )}
              {needsWallet ? "Save locally" : "Publish"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-faint">{label}</span>
      <span
        className={`text-sm font-semibold text-text ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
