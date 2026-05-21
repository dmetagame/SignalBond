"use client";

import { ArrowLeftRight, Bell, CheckCircle2, ExternalLink, Inbox, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDashboard } from "./DashboardProvider";
import { shortHash } from "../../lib/dashboard-actions";
import { arcTxUrl } from "../../lib/explorer";
import { formatBps } from "../../lib/reputation";

type Notification = {
  id: string;
  title: string;
  subtitle: string;
  timestamp?: string;
  variant: "won" | "lost" | "tx";
  href?: string;
};

function timeAgo(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsDropdown() {
  const { signals, agents, lastOnchainTx } = useDashboard();
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const notifications: Notification[] = [];

  for (const signal of [...signals]
    .filter((s) => s.status === "settled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)) {
    const agent = agentMap.get(signal.agentId);
    const won = signal.correct === true;
    notifications.push({
      id: signal.id,
      title: `${agent?.name ?? "Agent"} · ${won ? "Won" : "Lost"} ${formatBps(signal.pnlBps ?? 0)}`,
      subtitle: `${signal.market} · ${signal.direction}`,
      timestamp: timeAgo(signal.createdAt, nowMs),
      variant: won ? "won" : "lost",
    });
  }

  if (lastOnchainTx) {
    notifications.unshift({
      id: `tx-${lastOnchainTx}`,
      title: "Onchain transaction submitted",
      subtitle: shortHash(lastOnchainTx),
      variant: "tx",
      href: arcTxUrl(lastOnchainTx),
    });
  }

  const unreadCount = notifications.length;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-muted hover:text-text"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <span className="text-sm font-semibold text-text">Notifications</span>
            <span className="text-[11px] uppercase tracking-wider text-faint">
              {unreadCount > 0 ? `${unreadCount} recent` : "Empty"}
            </span>
          </header>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Inbox className="size-6 text-faint" strokeWidth={1.5} />
              <p className="text-sm text-muted">
                Settlements and onchain activity will show up here.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-line-soft overflow-y-auto">
              {notifications.map((n) => {
                const body = (
                  <>
                    <span
                      className={[
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                        n.variant === "won"
                          ? "bg-success-soft text-success"
                          : n.variant === "lost"
                            ? "bg-danger-soft text-danger"
                            : "bg-accent-soft text-accent",
                      ].join(" ")}
                    >
                      {n.variant === "won" ? (
                        <CheckCircle2 className="size-4" strokeWidth={2} />
                      ) : n.variant === "lost" ? (
                        <XCircle className="size-4" strokeWidth={2} />
                      ) : (
                        <ArrowLeftRight className="size-4" strokeWidth={2} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text">{n.title}</div>
                      <div className="flex items-center gap-1 truncate text-xs text-muted">
                        {n.subtitle}
                        {n.href && <ExternalLink className="size-3 text-faint" strokeWidth={1.75} />}
                      </div>
                    </div>
                    {n.timestamp && (
                      <span className="shrink-0 text-[11px] text-faint">{n.timestamp}</span>
                    )}
                  </>
                );

                return (
                  <li key={n.id}>
                    {n.href ? (
                      <a
                        href={n.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-3 px-4 py-3 hover:bg-panel-muted/40"
                      >
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3 hover:bg-panel-muted/40">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
