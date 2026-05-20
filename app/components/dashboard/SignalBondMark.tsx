import { useId } from "react";

type Props = {
  size?: number;
  className?: string;
  withBackground?: boolean;
  title?: string;
};

const LIME = "#d4ff3e";
const SHADOW = "#1a2e1a";
const HIGHLIGHT = "#a8b87a";

export default function SignalBondMark({
  size = 40,
  className,
  withBackground = false,
  title = "SignalBond",
}: Props) {
  const id = useId().replace(/:/g, "");
  const top = `sb-top-${id}`;
  const bot = `sb-bot-${id}`;
  const diag = `sb-diag-${id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={top} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={HIGHLIGHT} />
          <stop offset="100%" stopColor={SHADOW} />
        </linearGradient>
        <linearGradient id={bot} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={SHADOW} />
          <stop offset="100%" stopColor={HIGHLIGHT} />
        </linearGradient>
        <linearGradient id={diag} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={SHADOW} />
          <stop offset="42%" stopColor={HIGHLIGHT} />
          <stop offset="58%" stopColor={HIGHLIGHT} />
          <stop offset="100%" stopColor={SHADOW} />
        </linearGradient>
      </defs>

      {withBackground && <rect x="0" y="0" width="100" height="100" fill={LIME} />}

      <polygon points="80,36 66,36 20,64 34,64" fill={`url(#${diag})`} />
      <rect x="20" y="22" width="60" height="14" fill={`url(#${top})`} />
      <rect x="20" y="64" width="60" height="14" fill={`url(#${bot})`} />
    </svg>
  );
}
