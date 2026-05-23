"use client";

import {
  ArrowUpRight,
  Copy,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import ThemeToggle from "../../components/dashboard/ThemeToggle";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import {
  arcCanteen,
  contractsConfigured,
  faucetUrl,
  signalBondAddress,
  usdcAddress,
} from "../../lib/contract";
import { shortHash } from "../../lib/dashboard-actions";
import { arcAddressUrl } from "../../lib/explorer";
import { formatUsdc } from "../../lib/reputation";

export default function SettingsPage() {
  const {
    walletAddress,
    walletBalanceUsdc,
    walletOnArc,
    syncState,
    connectWallet,
    disconnectWallet,
    refreshChainState,
    resolverAddress,
    ownerAddress,
    treasuryAddress,
    slashedStakeUsdc,
  } = useDashboard();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <SectionHeader
        title="Settings"
        subtitle="Wallet session, network configuration, and contract controls for the live demo."
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          icon={<Wallet className="size-4" strokeWidth={1.75} />}
          title="Wallet Session"
          description="Connection state and Arc balance used for publishing and settlement."
        >
          <div className="space-y-3">
            <ValueRow
              label="Connected wallet"
              value={walletAddress ? shortHash(walletAddress) : "Not connected"}
              copyValue={walletAddress}
            />
            <ValueRow
              label="Network"
              value={walletOnArc ? "Arc Testnet" : walletAddress ? "Switch required" : "No wallet"}
              tone={walletOnArc ? "success" : walletAddress ? "warning" : "muted"}
            />
            <ValueRow
              label="Wallet USDC"
              value={walletBalanceUsdc === undefined ? "Not loaded" : formatUsdc(walletBalanceUsdc)}
            />
            <div className="flex flex-wrap gap-2 pt-2">
              {walletAddress ? (
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted hover:text-text"
                >
                  <LogOut className="size-4" strokeWidth={1.75} />
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-strong"
                >
                  <Wallet className="size-4" strokeWidth={1.75} />
                  Connect wallet
                </button>
              )}
              <button
                type="button"
                onClick={refreshChainState}
                disabled={syncState === "syncing"}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted hover:text-text disabled:opacity-60"
              >
                <RefreshCw
                  className={`size-4 ${syncState === "syncing" ? "animate-spin" : ""}`}
                  strokeWidth={1.75}
                />
                Refresh state
              </button>
            </div>
          </div>
        </Panel>

        <Panel
          icon={<Settings className="size-4" strokeWidth={1.75} />}
          title="Interface"
          description="Display preference stored locally in this browser."
        >
          <div className="flex items-center justify-between rounded-xl border border-line-soft bg-panel-muted p-3">
            <div>
              <div className="text-sm font-semibold text-text">Theme</div>
              <p className="mt-0.5 text-xs text-muted">Switch between light and dark mode.</p>
            </div>
            <ThemeToggle />
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          title="Arc Network"
          description="Runtime network values used by the wallet and public client."
        >
          <ValueRow label="Chain" value={`${arcCanteen.name} (${arcCanteen.id})`} />
          <ValueRow label="Configured" value={contractsConfigured ? "Yes" : "No"} />
          <ExternalRow label="Faucet" value="Circle faucet" href={faucetUrl} />
        </Panel>

        <Panel
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          title="Contracts"
          description="Primary addresses for the SignalBond demo deployment."
        >
          <AddressRow label="SignalBond" value={signalBondAddress} />
          <AddressRow label="USDC" value={usdcAddress} />
          <AddressRow label="Resolver" value={resolverAddress} />
        </Panel>

        <Panel
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          title="Settlement Roles"
          description="Control surfaces that matter during the judge demo."
        >
          <AddressRow label="Owner" value={ownerAddress} />
          <AddressRow label="Treasury" value={treasuryAddress} />
          <ValueRow label="Slashed reserve" value={formatUsdc(slashedStakeUsdc)} />
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-card">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-muted text-muted">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ValueRow({
  label,
  value,
  copyValue,
  tone = "default",
}: {
  label: string;
  value: string;
  copyValue?: string;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-danger"
        : tone === "muted"
          ? "text-faint"
          : "text-text";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`inline-flex items-center gap-2 text-right font-mono text-xs ${toneClass}`}>
        {value}
        {copyValue && <CopyButton value={copyValue} label={label} />}
      </span>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return <ValueRow label={label} value="Not configured" tone="muted" />;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="inline-flex items-center gap-2 font-mono text-xs text-text">
        {shortHash(value)}
        <CopyButton value={value} label={label} />
        <a
          href={arcAddressUrl(value as `0x${string}`)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${label} on Arc explorer`}
          className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-panel-muted hover:text-text"
        >
          <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
        </a>
      </span>
    </div>
  );
}

function ExternalRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text hover:text-accent"
      >
        {value}
        <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
      </a>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value)}
      aria-label={`Copy ${label}`}
      className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-panel-muted hover:text-text"
    >
      <Copy className="size-3.5" strokeWidth={1.75} />
    </button>
  );
}
