"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleDollarSign,
  Gavel,
  HelpCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import SectionHeader from "../../components/dashboard/SectionHeader";

const demoSteps = [
  {
    title: "Connect wallet",
    body: "Use an injected wallet on Arc Testnet before publishing a signal.",
    icon: Wallet,
  },
  {
    title: "Fund with USDC",
    body: "Open the Circle faucet from the sidebar and claim Arc Testnet USDC.",
    icon: CircleDollarSign,
  },
  {
    title: "Run Quick Demo",
    body: "Generate a short-expiry proposal that can be published and settled during a walkthrough.",
    icon: Radio,
  },
  {
    title: "Publish signal",
    body: "Approve USDC, create the signal, then open its drawer to show Arc proof.",
    icon: ShieldCheck,
  },
  {
    title: "Settle outcome",
    body: "After expiry, resolve the signal and show the lifecycle ledger, wallet effect, and reputation update.",
    icon: Gavel,
  },
];

const troubleshooting = [
  {
    title: "Publish is stuck after approval",
    body: "Refresh chain state, verify wallet is on Arc Testnet, then retry Publish. Approval and publish are separate wallet transactions.",
  },
  {
    title: "Balance does not move on a loss",
    body: "Losses do not subtract again at settlement. The stake left the wallet at publish and moves from escrow into slashed reserve.",
  },
  {
    title: "Settlement button is locked",
    body: "Onchain settlement unlocks only after the signal expiry timestamp. Use Quick Demo for short-expiry judge flows.",
  },
  {
    title: "Proof link says Not indexed",
    body: "The contract storage is still authoritative. The UI labels missing event-log history instead of linking to an invalid transaction.",
  },
];

const links = [
  { label: "Agora hackathon", href: "https://agora.thecanteenapp.com/" },
  { label: "Arc docs", href: "https://docs.arc.io/" },
  { label: "Arc node guide", href: "https://arc-node.thecanteenapp.com/" },
  { label: "Circle faucet", href: "https://faucet.circle.com" },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <SectionHeader
        title="Help"
        subtitle="Demo flow, operational notes, and recovery paths for SignalBond on Arc."
      />

      <section className="rounded-2xl border border-line bg-panel p-6 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <HelpCircle className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">Judge Demo Flow</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              The strongest walkthrough is publish proof, escrow effect, settlement proof, then reputation impact.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {demoSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative rounded-xl border border-line-soft bg-panel-muted p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-panel text-muted">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-xs text-faint">{index + 1}</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-text">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-strong"
          >
            Open dashboard
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
          <Link
            href="/signals"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted hover:text-text"
          >
            Signal book
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Troubleshooting" icon={<RefreshCw className="size-4" strokeWidth={1.75} />}>
          <div className="divide-y divide-line-soft">
            {troubleshooting.map((item) => (
              <div key={item.title} className="py-4 first:pt-0 last:pb-0">
                <h3 className="text-sm font-semibold text-text">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Resources" icon={<BookOpen className="size-4" strokeWidth={1.75} />}>
          <div className="divide-y divide-line-soft">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 py-4 text-sm first:pt-0 last:pb-0 hover:text-accent"
              >
                <span className="font-semibold text-text">{link.label}</span>
                <ArrowUpRight className="size-4 text-faint" strokeWidth={1.75} />
              </a>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-card">
      <header className="mb-5 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-panel-muted text-muted">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-text">{title}</h2>
      </header>
      {children}
    </section>
  );
}
