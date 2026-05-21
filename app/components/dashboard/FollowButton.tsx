"use client";

import { Star } from "lucide-react";
import { useFollowed } from "../../lib/follow";
import type { Agent } from "../../lib/types";

export default function FollowButton({
  agent,
  size = "md",
}: {
  agent: Agent;
  size?: "sm" | "md";
}) {
  const { isFollowed, toggleFollow } = useFollowed();
  const followed = isFollowed(agent.id);

  const dims = size === "sm" ? "size-7 text-xs" : "size-8 text-sm";
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFollow(agent);
      }}
      aria-label={followed ? `Unpin ${agent.name}` : `Pin ${agent.name}`}
      aria-pressed={followed}
      title={followed ? "Pinned — click to unpin" : "Pin to /followed-agents"}
      className={[
        "flex shrink-0 items-center justify-center rounded-lg border transition-colors",
        dims,
        followed
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-line bg-panel text-faint hover:text-text hover:border-line-soft",
      ].join(" ")}
    >
      <Star
        className={iconSize}
        strokeWidth={followed ? 2.25 : 1.75}
        fill={followed ? "currentColor" : "none"}
      />
    </button>
  );
}
