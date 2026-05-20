import { ArrowRight, MoreHorizontal } from "lucide-react";

const SIZE = 220;
const STROKE = 18;
const CENTER = SIZE / 2;
const RADIUS = CENTER - STROKE / 2;

const ACCENT = "#d4ff3e";

function arcPath(percent: number): string {
  const clamped = Math.min(Math.max(percent, 0), 100) / 100;
  if (clamped <= 0) return "";
  const startAngle = Math.PI;
  const endAngle = startAngle + clamped * Math.PI;
  const x1 = CENTER + RADIUS * Math.cos(startAngle);
  const y1 = CENTER + RADIUS * Math.sin(startAngle);
  const x2 = CENTER + RADIUS * Math.cos(endAngle);
  const y2 = CENTER + RADIUS * Math.sin(endAngle);
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2}`;
}

function pointOnArc(percent: number): { x: number; y: number } {
  const clamped = Math.min(Math.max(percent, 0), 100) / 100;
  const angle = Math.PI + clamped * Math.PI;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

export default function Gauge({
  title,
  percent,
  target,
  resolvedCount,
}: {
  title: string;
  percent: number;
  target?: number;
  resolvedCount: number;
}) {
  const targetPoint = target !== undefined ? pointOnArc(target) : null;
  const status =
    target === undefined
      ? null
      : percent >= target
        ? `Above ${target}% target`
        : `${(target - percent).toFixed(1)} pts below ${target}% target`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-xs text-muted">Aggregate across resolved signals</p>
        </div>
        <button
          type="button"
          aria-label="Card actions"
          className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-panel-muted hover:text-muted"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE / 2 + 24 }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE / 2 + 16}`}
          width={SIZE}
          height={SIZE / 2 + 16}
          aria-hidden
        >
          <path
            d={arcPath(100)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {percent > 0 && (
            <path
              d={arcPath(percent)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          )}
          {targetPoint && (
            <g>
              <circle
                cx={targetPoint.x}
                cy={targetPoint.y}
                r={4}
                fill="currentColor"
                opacity={0.85}
              />
              <text
                x={targetPoint.x}
                y={targetPoint.y - 12}
                fontSize={10}
                fontWeight={600}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.7}
              >
                {target}%
              </text>
            </g>
          )}
        </svg>

        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="text-3xl font-semibold tracking-tight text-text tabular-nums">
            {percent.toFixed(0)}%
          </span>
          <span className="text-[11px] uppercase tracking-wider text-faint">
            {resolvedCount} resolved
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs ${status?.startsWith("Above") ? "text-success" : "text-muted"}`}>
          {status ?? "No target set"}
        </span>
        <a
          href="#"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text hover:text-accent"
        >
          Show details
          <ArrowRight className="size-3" strokeWidth={2} />
        </a>
      </div>
    </section>
  );
}
