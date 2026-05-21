"use client";

import { ArrowLeftRight, Copy, ExternalLink } from "lucide-react";
import { useDashboard } from "../../../components/dashboard/DashboardProvider";
import SectionHeader from "../../../components/dashboard/SectionHeader";
import { shortHash } from "../../../lib/dashboard-actions";
import { arcTxUrl } from "../../../lib/explorer";

export default function TransactionsPage() {
  const { lastOnchainTx, publishStage, busy } = useDashboard();
  const active = busy.onchain || publishStage !== "idle";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Transactions"
        subtitle="Activity from this session — last published call, last settlement."
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-6 shadow-card">
        {!lastOnchainTx && !active && (
          <div className="rounded-xl border border-dashed border-line-soft bg-panel-muted/40 px-3 py-12 text-center text-sm text-faint">
            No transactions yet this session. Publish a signal to see activity.
          </div>
        )}

        {active && (
          <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/30 px-4 py-3 text-sm text-text">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            <span className="flex-1">
              {publishStage === "approving"
                ? "Approving USDC…"
                : publishStage === "publishing"
                  ? "Confirm publish in your wallet…"
                  : publishStage === "confirming"
                    ? "Awaiting onchain confirmation…"
                    : "Transaction in flight…"}
            </span>
          </div>
        )}

        {lastOnchainTx && (
          <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-panel-muted px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ArrowLeftRight className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text">Last transaction</div>
              <code className="font-mono text-xs text-muted">{shortHash(lastOnchainTx)}</code>
            </div>
            <a
              href={arcTxUrl(lastOnchainTx)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted hover:text-text"
            >
              <ExternalLink className="size-3" strokeWidth={2} />
              View on Arcscan
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(lastOnchainTx)}
              aria-label="Copy tx hash"
              className="inline-flex size-7 items-center justify-center rounded-md text-faint hover:bg-panel-muted hover:text-text"
            >
              <Copy className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-dashed border-line-soft bg-panel-muted/40 p-6 text-center text-sm text-muted">
        Indexed historical transactions land here once we ship the contract event reader.
      </div>
    </div>
  );
}
