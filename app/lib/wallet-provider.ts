import { createPublicClient, custom } from "viem";
import { arcCanteen } from "./contract";

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function getWalletPublicClient() {
  if (!hasInjectedWallet() || !window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  return createPublicClient({
    chain: arcCanteen,
    transport: custom(window.ethereum),
  });
}

declare global {
  interface Window {
    ethereum?: {
      on?(event: string, handler: (...args: unknown[]) => void): void;
      removeListener?(event: string, handler: (...args: unknown[]) => void): void;
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}
