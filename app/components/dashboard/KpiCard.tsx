import type { LucideIcon } from "lucide-react";
import DeltaPill from "./DeltaPill";

export type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: { value: number; direction?: "up" | "down" | "flat" };
  context?: string;
};

export default function KpiCard({ label, value, icon: Icon, delta, context }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
          {label}
        </span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-panel-muted text-muted">
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight text-text tabular-nums">
          {value}
        </span>
        {delta && <DeltaPill value={delta.value} direction={delta.direction} />}
      </div>

      {context && (
        <p className="mt-2 text-xs text-muted">
          {context}
        </p>
      )}
    </div>
  );
}
