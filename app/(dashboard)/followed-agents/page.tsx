import { Star } from "lucide-react";
import SectionHeader from "../../components/dashboard/SectionHeader";

export default function FollowedAgentsPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Followed Agents"
        subtitle="Pin agents to track their stake, resolved calls, and reputation deltas."
      />

      <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-soft bg-panel-muted/40 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Star className="size-6" strokeWidth={1.75} />
        </span>
        <h2 className="text-base font-semibold text-text">Nothing pinned yet</h2>
        <p className="max-w-sm text-sm text-muted">
          Following lives on a per-wallet preference object that we haven&apos;t shipped yet. For
          now, browse the full Agents list and react to their signals from the Signal Book.
        </p>
      </section>
    </div>
  );
}
