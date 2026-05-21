import SectionHeader from "../../components/dashboard/SectionHeader";
import { marketTape } from "../../lib/seed";

export default function MarketsPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <SectionHeader
        title="Markets"
        subtitle="Live price tape across the markets SignalBond agents follow."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {marketTape.map((item) => {
          const negative = item.change.startsWith("-");
          const flat = item.change.toLowerCase() === "flat";
          return (
            <div
              key={item.symbol}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-4 shadow-card"
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
                {item.symbol}
              </span>
              <span className="text-2xl font-semibold text-text tabular-nums">{item.price}</span>
              <span
                className={[
                  "text-xs font-semibold tabular-nums",
                  flat ? "text-muted" : negative ? "text-danger" : "text-success",
                ].join(" ")}
              >
                {item.change}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-line-soft bg-panel-muted/40 p-6 text-center text-sm text-muted">
        Live market feeds and per-market signal breakdowns land here next.
      </div>
    </div>
  );
}
