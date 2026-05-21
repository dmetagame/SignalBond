"use client";

import { useState } from "react";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import SignalTable from "../../components/dashboard/SignalTable";

type Filter = "all" | "active" | "won" | "lost";

const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export default function SignalsPage() {
  const { signals, agents, selectSignal, resolveSignal, busy } = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = signals.filter((s) => {
    if (filter === "all") return true;
    if (filter === "active") return s.status === "active";
    if (filter === "won") return s.status === "settled" && s.correct === true;
    if (filter === "lost") return s.status === "settled" && s.correct === false;
    return true;
  });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Signals"
        subtitle="Every market call published to SignalBond, with stake and outcome."
      />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === tab.id
                ? "bg-accent text-accent-foreground"
                : "border border-line bg-panel text-muted hover:text-text",
            ].join(" ")}
          >
            {tab.label}
            <span className="ml-2 text-[11px] tabular-nums opacity-70">
              {tab.id === "all"
                ? signals.length
                : tab.id === "active"
                  ? signals.filter((s) => s.status === "active").length
                  : tab.id === "won"
                    ? signals.filter((s) => s.status === "settled" && s.correct).length
                    : signals.filter((s) => s.status === "settled" && !s.correct).length}
            </span>
          </button>
        ))}
      </div>

      <SignalTable
        signals={filtered}
        agents={agents}
        onSelect={selectSignal}
        onResolve={resolveSignal}
        resolving={busy.onchain}
      />
    </div>
  );
}
