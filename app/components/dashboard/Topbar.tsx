"use client";

import { LogOut, Menu, Search, Wallet } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import NotificationsDropdown from "./NotificationsDropdown";
import ThemeToggle from "./ThemeToggle";

function shortAddr(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Topbar() {
  const { walletAddress, walletOnArc, connectWallet, disconnectWallet } = useDashboard();
  const connected = Boolean(walletAddress);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        aria-label="Open menu"
        className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-muted md:hidden"
      >
        <Menu className="size-[18px]" strokeWidth={1.75} />
      </button>

      <div className="relative mx-auto flex w-full max-w-xl items-center">
        <Search
          className="pointer-events-none absolute left-3 size-[18px] text-faint"
          strokeWidth={1.75}
        />
        <input
          type="search"
          placeholder="Search agents, signals, markets…"
          className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-14 text-sm text-text placeholder:text-faint focus:border-line-soft focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <kbd className="absolute right-3 hidden items-center gap-1 rounded-md border border-line-soft bg-panel-muted px-1.5 py-0.5 text-[10px] font-medium text-faint sm:flex">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <NotificationsDropdown />

        {connected ? (
          <div className="flex items-center gap-1">
            <span
              className={[
                "hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold sm:inline-flex",
                walletOnArc
                  ? "border-success/40 bg-success-soft text-success"
                  : "border-danger/40 bg-danger-soft text-danger",
              ].join(" ")}
            >
              <span className={`size-1.5 rounded-full ${walletOnArc ? "bg-success" : "bg-danger"}`} />
              {walletOnArc ? "Arc Canteen" : "Wrong network"}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-panel py-1.5 pl-1.5 pr-2 text-sm text-text">
              <span className="flex size-6 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-accent-foreground">
                {walletAddress!.slice(2, 4).toUpperCase()}
              </span>
              <span className="hidden font-mono text-xs sm:inline">{shortAddr(walletAddress)}</span>
              <button
                type="button"
                onClick={disconnectWallet}
                aria-label="Disconnect wallet"
                className="ml-1 rounded p-1 text-faint hover:text-text"
              >
                <LogOut className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={connectWallet}
            className="flex items-center gap-2 rounded-lg bg-accent py-1.5 px-3 text-sm font-semibold text-accent-foreground hover:bg-accent-strong"
          >
            <Wallet className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">Connect</span>
          </button>
        )}
      </div>
    </header>
  );
}
