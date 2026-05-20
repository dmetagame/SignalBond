import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Agent, Signal } from "../../lib/types";

export default function AgentAssistant({
  signal,
  agent,
}: {
  signal?: Signal;
  agent?: Agent;
}) {
  const hasSignal = signal && agent;

  return (
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-card">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(212,255,62,0.55), rgba(212,255,62,0.05) 60%, transparent 80%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full"
        style={{
          background:
            "conic-gradient(from 140deg at 50% 50%, rgba(212,255,62,0.9), rgba(245,184,75,0.55), rgba(101,214,255,0.65), rgba(212,255,62,0.9))",
          filter: "blur(2px) saturate(120%)",
          opacity: 0.55,
        }}
      />

      <header className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles className="size-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">Agent Assistant</h2>
            <p className="text-xs text-muted">Latest reasoning</p>
          </div>
        </div>
      </header>

      <div className="relative flex flex-col gap-3">
        {hasSignal ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-md text-[11px] font-semibold uppercase"
                style={{
                  backgroundColor: `${agent.color}22`,
                  color: agent.color,
                  border: `1px solid ${agent.color}55`,
                }}
              >
                {agent.handle.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">{agent.name}</div>
                <div className="truncate text-xs text-muted">
                  {signal.market} · {signal.direction}
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-muted line-clamp-4">
              {signal.reasoning}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            No reasoning published yet. Run an agent cycle to surface the next signal.
          </p>
        )}

        <a
          href="#"
          className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-text hover:text-accent"
        >
          Open assistant
          <ArrowUpRight className="size-3" strokeWidth={2} />
        </a>
      </div>
    </section>
  );
}
