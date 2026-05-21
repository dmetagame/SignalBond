"use client";

import { Copy, ExternalLink, FileCode2 } from "lucide-react";
import type { Address } from "viem";
import { useDashboard } from "../../../components/dashboard/DashboardProvider";
import SectionHeader from "../../../components/dashboard/SectionHeader";
import { demoUsdcAddress, signalBondAddress } from "../../../lib/contract";
import { arcAddressUrl } from "../../../lib/explorer";

export default function ContractsPage() {
  const { resolverAddress, ownerAddress, contractSignalCount } = useDashboard();

  const rows: { label: string; value?: string }[] = [
    { label: "SignalBond contract", value: signalBondAddress },
    { label: "Demo USDC", value: demoUsdcAddress },
    { label: "Resolver", value: resolverAddress },
    { label: "Owner", value: ownerAddress },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Contracts"
        subtitle="Deployed contract addresses and resolver roles on Arc Canteen."
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-6 shadow-card">
        <header className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <FileCode2 className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">Deployment</h2>
            <p className="text-xs text-muted">
              {contractSignalCount !== undefined
                ? `${contractSignalCount} signals indexed onchain`
                : "Awaiting onchain handshake"}
            </p>
          </div>
        </header>

        <div className="divide-y divide-line-soft">
          {rows.map((row) => (
            <AddressRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code className="rounded-md bg-panel-muted px-2 py-1 font-mono text-xs text-text">
          {value ?? "not configured"}
        </code>
        {value && (
          <a
            href={arcAddressUrl(value as Address)}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${label} on Arcscan`}
            className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-panel-muted hover:text-text"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
          </a>
        )}
        {value && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(value)}
            aria-label={`Copy ${label}`}
            className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-panel-muted hover:text-text"
          >
            <Copy className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}
