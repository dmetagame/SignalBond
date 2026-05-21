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

function readStorage(): FollowMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as FollowMap;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStorage(map: FollowMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
  } catch {
    // localStorage may be disabled in private mode; failures are non-fatal.
  }
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

const emptyMap: FollowMap = {};
function getSnapshot(): FollowMap {
  return readStorage();
}
function getServerSnapshot(): FollowMap {
  return emptyMap;
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
    const current = readStorage();
    current[agent.id] = snapshotAgent(agent);
    writeStorage(current);
  }, []);

  const unpin = useCallback((agentId: string) => {
    const current = readStorage();
    if (current[agentId]) {
      delete current[agentId];
      writeStorage(current);
    }
  }, []);

  const toggleFollow = useCallback(
    (agent: Agent) => {
      if (isFollowed(agent.id)) unpin(agent.id);
      else pin(agent);
    },
    [isFollowed, pin, unpin],
  );

  const clearAll = useCallback(() => {
    writeStorage({});
  }, []);

  // Re-snapshot guard: if an agent's identity is in storage but the snapshot is
  // malformed (e.g. from an older schema), drop it on first read.
  useEffect(() => {
    let dirty = false;
    const current = readStorage();
    for (const [id, snap] of Object.entries(current)) {
      if (
        !snap ||
        typeof snap !== "object" ||
        typeof snap.reputation !== "number" ||
        typeof snap.resolvedSignals !== "number"
      ) {
        delete current[id];
        dirty = true;
      }
    }
    if (dirty) writeStorage(current);
  }, []);

  return { followed, isFollowed, toggleFollow, pin, unpin, clearAll };
}
