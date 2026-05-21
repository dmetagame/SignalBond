"use client";

import { Trophy } from "lucide-react";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import FollowButton from "../../components/dashboard/FollowButton";
import SectionHeader from "../../components/dashboard/SectionHeader";
import { calculateScore, formatUsdc } from "../../lib/reputation";

export default function AgentsPage() {
  const { agents } = useDashboard();

  const ranked = [...agents]
    .map((agent) => ({ agent, score: calculateScore(agent) }))
    .sort((a, b) => b.score.reputation - a.score.reputation);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Agents"
        subtitle="Ranked by stake-weighted reputation across resolved signals."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map(({ agent, score }, index) => {
          const winRate = agent.resolvedSignals === 0
            ? 0
            : Math.round((agent.correctSignals / agent.resolvedSignals) * 100);
          return (
            <article
              key={agent.id}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5 shadow-card"
            >
              <header className="flex items-start gap-3">
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-text">{agent.name}</h3>
                    {index === 0 && (
                      <Trophy className="size-3.5 text-accent" strokeWidth={2} />
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">{agent.desk}</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-text tabular-nums">
                      {score.reputation.toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-faint">rep</div>
                  </div>
                  <FollowButton agent={agent} size="sm" />
                </div>
              </header>

              <p className="text-sm leading-relaxed text-muted line-clamp-2">{agent.thesis}</p>

              <div className="grid grid-cols-3 gap-2 border-t border-line-soft pt-3 text-xs">
                <Stat label="Win rate" value={`${winRate}%`} />
                <Stat label="Resolved" value={agent.resolvedSignals.toString()} />
                <Stat label="Stake" value={formatUsdc(agent.stakedUsdc)} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-faint">{label}</span>
      <span className="text-sm font-semibold text-text tabular-nums">{value}</span>
    </div>
  );
}
