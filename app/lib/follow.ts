"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Agent } from "./types";
import { calculateScore } from "./reputation";

/**
 * Localstorage-backed follow list. Each pinned agent stores a snapshot of its
 * stats at pin-time so /followed-agents can show the user how those metrics
 * have moved since they pinned. Stored as a single JSON-encoded record under
 * `signalbond:followed` for easy migration if we ever back this with a wallet
 * preferences object.
 */

const STORAGE_KEY = "signalbond:followed";
const STORAGE_EVENT = "signalbond:followed-change";

export type FollowSnapshot = {
  pinnedAt: string;
  reputation: number;
  resolvedSignals: number;
  correctSignals: number;
  stakedUsdc: number;
  cumulativePnlBps: number;
};

export type FollowMap = Record<string, FollowSnapshot>;

const EMPTY_MAP: FollowMap = Object.freeze({}) as FollowMap;

let cachedRaw: string | null | undefined;
let cachedMap: FollowMap = EMPTY_MAP;

function parse(raw: string | null): FollowMap {
  if (!raw) return EMPTY_MAP;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as FollowMap;
    return EMPTY_MAP;
  } catch {
    return EMPTY_MAP;
  }
}

function readStorage(): FollowMap {
  if (typeof window === "undefined") return EMPTY_MAP;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  // useSyncExternalStore needs a stable reference between calls when the
  // underlying data hasn't changed; cache the parsed map keyed by the raw
  // string so identity only flips after a real write.
  if (raw === cachedRaw) return cachedMap;
  cachedRaw = raw;
  cachedMap = parse(raw);
  return cachedMap;
}

function writeStorage(map: FollowMap): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(map);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedMap = map;
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
  } catch {
    // localStorage may be disabled in private mode; failures are non-fatal.
  }
}

function mutate(updater: (current: FollowMap) => FollowMap): void {
  const current = readStorage();
  // Spread to avoid mutating the cached reference in place — every write
  // must produce a fresh object identity so subscribers re-render.
  const next = updater({ ...current });
  writeStorage(next);
}

export function snapshotAgent(agent: Agent): FollowSnapshot {
  return {
    pinnedAt: new Date().toISOString(),
    reputation: calculateScore(agent).reputation,
    resolvedSignals: agent.resolvedSignals,
    correctSignals: agent.correctSignals,
    stakedUsdc: agent.stakedUsdc,
    cumulativePnlBps: agent.cumulativePnlBps,
  };
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onCustom);
  };
}

function getSnapshot(): FollowMap {
  return readStorage();
}
function getServerSnapshot(): FollowMap {
  return EMPTY_MAP;
}

export function useFollowed(): {
  followed: FollowMap;
  isFollowed: (agentId: string) => boolean;
  toggleFollow: (agent: Agent) => void;
  pin: (agent: Agent) => void;
  unpin: (agentId: string) => void;
  clearAll: () => void;
} {
  const followed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isFollowed = useCallback(
    (agentId: string) => Object.prototype.hasOwnProperty.call(followed, agentId),
    [followed],
  );

  const pin = useCallback((agent: Agent) => {
    mutate((current) => {
      current[agent.id] = snapshotAgent(agent);
      return current;
    });
  }, []);

  const unpin = useCallback((agentId: string) => {
    mutate((current) => {
      delete current[agentId];
      return current;
    });
  }, []);

  const toggleFollow = useCallback(
    (agent: Agent) => {
      if (isFollowed(agent.id)) unpin(agent.id);
      else pin(agent);
    },
    [isFollowed, pin, unpin],
  );

  const clearAll = useCallback(() => {
    writeStorage(EMPTY_MAP);
  }, []);

  // Re-snapshot guard: if an entry is malformed (e.g. older schema) drop it
  // once on mount. Runs after first paint so it never blocks hydration.
  useEffect(() => {
    const current = readStorage();
    const next = { ...current };
    let dirty = false;
    for (const [id, snap] of Object.entries(next)) {
      if (
        !snap ||
        typeof snap !== "object" ||
        typeof snap.reputation !== "number" ||
        typeof snap.resolvedSignals !== "number"
      ) {
        delete next[id];
        dirty = true;
      }
    }
    if (dirty) writeStorage(next);
  }, []);

  return { followed, isFollowed, toggleFollow, pin, unpin, clearAll };
}
