import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Direction = "up" | "down" | "flat";

export default function DeltaPill({
  value,
  direction,
  suffix = "%",
}: {
  value: number;
  direction?: Direction;
  suffix?: string;
}) {
  const dir: Direction = direction ?? (value > 0 ? "up" : value < 0 ? "down" : "flat");
  const isUp = dir === "up";
  const isDown = dir === "down";
  const Icon = isDown ? ArrowDownRight : ArrowUpRight;
  const color = isUp
    ? "bg-success-soft text-success"
    : isDown
      ? "bg-danger-soft text-danger"
      : "bg-panel-muted text-muted";

  const display = `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}
    >
      <Icon className="size-3" strokeWidth={2.25} />
      {display}
    </span>
  );
}
