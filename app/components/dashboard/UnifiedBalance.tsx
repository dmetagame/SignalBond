"use client";

import { Layers, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useDashboard } from "./DashboardProvider";
import {
  readUnifiedUsdc,
  unifiedChains,
  type ChainBalance,
} from "../../lib/unified-balance";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function UnifiedBalance() {
  const { walletAddress } = useDashboard();
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [total, setTotal] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>();

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const result = await readUnifiedUsdc(walletAddress as Address);
      setBalances(result.balances);
      setTotal(result.total);
      setLastSyncedAt(Date.now());
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      void refresh();
    } else {
      setBalances([]);
      setTotal(0n);
    }
  }, [walletAddress, refresh]);

  if (!walletAddress) {
    return (
      <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5 shadow-card">
        <header className="flex items-center gap-2">
          <Layers className="size-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-text">Unified balance</h3>
        </header>
        <p className="text-xs text-muted">
          Connect your wallet to see your USDC across Sepolia, Base Sepolia, and Arc Testnet
          — the chains Circle Gateway treats as a single liquidity pool.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5 shadow-card">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-text">Unified balance</h3>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh balances"
          className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-panel-muted hover:text-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            strokeWidth={1.75}
          />
        </button>
      </header>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-text">
          {usd(Number(formatUnits(total, 6)))}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-faint">total</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {(balances.length === 0
          ? unifiedChains.map<ChainBalance>((entry) => ({ entry, balance: 0n }))
          : balances
        ).map(({ entry, balance, error }) => {
            const display = error
              ? "unavailable"
              : usd(Number(formatUnits(balance, 6)));
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-line-soft bg-panel-muted/40 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "size-1.5 rounded-full",
                      entry.isGatewayChain ? "bg-accent" : "bg-success",
                    ].join(" ")}
                  />
                  <span className="font-medium text-text">{entry.name}</span>
                  {entry.isGatewayChain ? (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                      Gateway
                    </span>
                  ) : (
                    <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-semibold text-success">
                      Stake
                    </span>
                  )}
                </div>
                <span className="font-mono tabular-nums text-text">{display}</span>
              </li>
            );
          })}
      </ul>

      <p className="text-[10px] leading-snug text-faint">
        Mirrors Circle Gateway&apos;s unified-balance model: USDC on supported chains acts as one
        spendable pool. Stake calls on Arc consume from the local balance; the{" "}
        <span className="font-semibold text-muted">/bridge</span> page tops it up via CCTP.
      </p>

      {lastSyncedAt && (
        <span className="text-[10px] text-faint">
          Synced {new Date(lastSyncedAt).toLocaleTimeString()}
        </span>
      )}
    </aside>
  );
}
