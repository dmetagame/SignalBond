"use client";

import {
  LayoutDashboard,
  Radio,
  Users,
  LineChart,
  Scale,
  Boxes,
  ChevronDown,
  FileCode2,
  ArrowLeftRight,
  ListChecks,
  BarChart3,
  Star,
  Settings,
  HelpCircle,
  Wallet,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import SignalBondMark from "./SignalBondMark";

type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  badge?: string | number;
};

function buildPrimaryNav(activeSignalCount: number): NavItem[] {
  return [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    {
      label: "Signals",
      icon: Radio,
      href: "/signals",
      badge: activeSignalCount > 0 ? activeSignalCount : undefined,
    },
    { label: "Agents", icon: Users, href: "/agents" },
    { label: "Markets", icon: LineChart, href: "/markets" },
    { label: "Settlement", icon: Scale, href: "/settlement" },
  ];
}

const onchainNav: NavItem[] = [
  { label: "Contracts", icon: FileCode2, href: "/onchain/contracts" },
  { label: "Transactions", icon: ArrowLeftRight, href: "/onchain/transactions" },
  { label: "Resolver log", icon: ListChecks, href: "/onchain/resolver-log" },
];

const secondaryNav: NavItem[] = [
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Followed Agents", icon: Star, href: "/followed-agents" },
];

const footerNav: NavItem[] = [
  { label: "Settings", icon: Settings, href: "#" },
  { label: "Help", icon: HelpCircle, href: "#" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "#") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const className = [
    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-accent text-accent-foreground"
      : "text-muted hover:bg-panel-muted hover:text-text",
  ].join(" ");

  const inner = (
    <>
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && (
        <span
          className={[
            "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            active
              ? "bg-accent-foreground/15 text-accent-foreground"
              : "bg-panel-muted text-muted",
          ].join(" ")}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.href === "#") {
    return (
      <span className={`${className} opacity-60 cursor-not-allowed`} aria-disabled>
        {inner}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {inner}
    </Link>
  );
}

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink key={item.label} item={item} active={isActive(pathname, item.href)} />
      ))}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname() ?? "/";
  const [onchainOpen, setOnchainOpen] = useState(true);
  const {
    signals,
    walletAddress,
    walletBalanceUsdc,
    demoUsdcClaimed,
    connectWallet,
    claimDemoUsdc,
    busy,
  } = useDashboard();

  const activeSignalCount = signals.filter((s) => s.status === "active").length;
  const primaryNav = buildPrimaryNav(activeSignalCount);
  const connected = Boolean(walletAddress);
  const claimDisabled = connected && (busy.claim || demoUsdcClaimed === true);
  const claimLabel = demoUsdcClaimed ? "Claimed" : busy.claim ? "Claiming..." : "Claim";

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col gap-6 border-r border-line bg-panel px-4 py-6">
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent overflow-hidden">
          <SignalBondMark size={36} />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-tight">SignalBond</span>
          <span className="text-[11px] uppercase tracking-wider text-faint">Arc reputation</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <NavSection items={primaryNav} pathname={pathname} />

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setOnchainOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint hover:text-muted"
          >
            <Boxes className="size-3.5" strokeWidth={2} />
            <span className="flex-1 text-left">Onchain</span>
            <ChevronDown
              className={`size-3.5 transition-transform ${onchainOpen ? "" : "-rotate-90"}`}
              strokeWidth={2}
            />
          </button>
          {onchainOpen && <NavSection items={onchainNav} pathname={pathname} />}
        </div>

        <NavSection items={secondaryNav} pathname={pathname} />
      </nav>

      <div className="flex flex-col gap-3">
        <NavSection items={footerNav} pathname={pathname} />

        <div className="rounded-2xl border border-line-soft bg-panel-muted p-4">
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            {connected ? (
              <Coins className="size-5" strokeWidth={1.75} />
            ) : (
              <Wallet className="size-5" strokeWidth={1.75} />
            )}
          </div>
          <div className="text-sm font-semibold text-text">
            {connected ? "Claim Demo USDC" : "Connect Wallet"}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {connected
              ? walletBalanceUsdc !== undefined
                ? `Balance ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(walletBalanceUsdc)} · One faucet claim per wallet.`
                : "Claim demo USDC once to stake your next call."
              : "Stake calls and earn reputation on Arc Canteen."}
          </p>
          <button
            type="button"
            onClick={connected ? claimDemoUsdc : connectWallet}
            disabled={claimDisabled}
            className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
          >
            {connected ? claimLabel : "Connect"}
          </button>
        </div>
      </div>
    </aside>
  );
}
