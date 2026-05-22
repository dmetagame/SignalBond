import {
  createWalletClient,
  custom,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  arcCanteen,
  demoUsdcAddress,
  erc20Abi,
  signalBondAbi,
  signalBondAddress,
} from "./contract";
import { agentHash, getPublicClient } from "./onchain";
import {
  directionToContractValue,
  generateAgentScan,
  type AgentScan,
} from "./agent-scan";
import type { ChainState } from "./chain-state";
import type { Agent, Direction, Signal } from "./types";
import { getWalletPublicClient, hasInjectedWallet } from "./wallet-provider";

const WALLET_REQUEST_TIMEOUT_MS = 120_000;
const TX_RECEIPT_TIMEOUT_MS = 45_000;

export function isBullish(direction: Direction): boolean {
  return direction === "LONG" || direction === "YES";
}

export function resetAgentStats(agent: Agent): Agent {
  return {
    ...agent,
    stakedUsdc: 0,
    resolvedSignals: 0,
    correctSignals: 0,
    cumulativePnlBps: 0,
    calibrationBps: 0,
    maxDrawdownBps: 0,
  };
}

export function scanToSignal(scan: AgentScan, id: string): Signal {
  return {
    id,
    agentId: scan.agentId,
    market: scan.market,
    venue: scan.venue,
    direction: scan.direction,
    confidenceBps: scan.confidenceBps,
    stakeUsdc: scan.stakeUsdc,
    entryPrice: scan.entryPrice,
    targetPrice: scan.targetPrice,
    createdAt: scan.generatedAt,
    expiresAt: scan.expiresAt,
    status: "active",
    sourceHash: scan.sourceHash,
    txHash: pseudoHash(`${id}:${scan.market}:tx`),
    reasoning: scan.reasoning,
    sources: scan.sources,
  };
}

export async function publishSignalOnchain(
  signal: Signal,
  account: Address,
  onStage?: (stage: "approving" | "publishing" | "confirming") => void,
): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  if (!signalBondAddress || !demoUsdcAddress) {
    throw new Error("Contract addresses are not configured.");
  }

  await ensureArcNetwork();

  const walletClient = createWalletClient({
    account,
    chain: arcCanteen,
    transport: custom(window.ethereum),
  });
  const walletPublicClient = getWalletPublicClient();
  const stakeAmount = parseUnits(String(signal.stakeUsdc), 6);

  const existingAllowance = await readUsdcAllowance(
    account,
    signalBondAddress,
    walletPublicClient,
  );
  if (existingAllowance < stakeAmount) {
    onStage?.("approving");
    const approveHash = await withWalletTimeout(
      walletClient.writeContract({
        address: demoUsdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [signalBondAddress, stakeAmount],
      }),
      "USDC approval signature",
    );
    await waitForApproval(
      approveHash,
      account,
      signalBondAddress,
      stakeAmount,
      walletPublicClient,
    );
  }

  onStage?.("publishing");
  return withWalletTimeout(
    walletClient.writeContract({
      address: signalBondAddress,
      abi: signalBondAbi,
      functionName: "createSignal",
      args: [
        agentHash(signal.agentId),
        signal.market,
        directionToContractValue(signal.direction),
        signal.confidenceBps,
        stakeAmount,
        BigInt(Math.floor(new Date(signal.expiresAt).getTime() / 1000)),
        signal.sourceHash,
        keccak256(stringToHex(signal.reasoning)),
      ],
    }),
    "Signal publishing signature",
  );
}

export async function resolveSignalOnchain(
  signal: Signal,
  account: Address,
  correct: boolean,
  pnlBps: number,
): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  if (!signalBondAddress || !signal.onchainId) {
    throw new Error("SignalBond address or onchain signal id is not configured.");
  }

  await ensureArcNetwork();

  const walletClient = createWalletClient({
    account,
    chain: arcCanteen,
    transport: custom(window.ethereum),
  });

  return walletClient.writeContract({
    address: signalBondAddress,
    abi: signalBondAbi,
    functionName: "resolveSignal",
    args: [BigInt(signal.onchainId), correct, BigInt(pnlBps)],
  });
}

async function readUsdcAllowance(
  owner: Address,
  spender: Address,
  publicClient = getBrowserSafePublicClient(),
): Promise<bigint> {
  return publicClient.readContract({
    address: demoUsdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
}

async function waitForApproval(
  approveHash: Hex,
  owner: Address,
  spender: Address,
  amount: bigint,
  publicClient = getBrowserSafePublicClient(),
): Promise<void> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
      timeout: TX_RECEIPT_TIMEOUT_MS,
    });
    if (receipt.status === "reverted") {
      throw new Error("USDC approval reverted on Arc.");
    }
    return;
  } catch (error) {
    const allowance = await readUsdcAllowance(owner, spender);
    if (allowance >= amount) {
      return;
    }

    const message = normalizeError(error);
    throw new Error(`USDC approval did not finalize. ${message}`);
  }
}

function getBrowserSafePublicClient() {
  return hasInjectedWallet() ? getWalletPublicClient() : getPublicClient();
}

export async function ensureArcNetwork(): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  const chainId = numberToHexChainId(arcCanteen.id);
  const currentChainId = (await window.ethereum.request({
    method: "eth_chainId",
  })) as string;

  if (currentChainId.toLowerCase() === chainId.toLowerCase()) {
    return chainId;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if (!isUnknownChainError(error)) {
      throw error;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: arcCanteen.name,
          nativeCurrency: arcCanteen.nativeCurrency,
          rpcUrls: arcCanteen.rpcUrls.default.http,
        },
      ],
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }

  return chainId;
}

export function numberToHexChainId(value: number): Hex {
  return `0x${value.toString(16)}`;
}

export function sameChainId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isUnknownChainError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 4902
  );
}

function pseudoHash(input: string): `0x${string}` {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index);
  }

  const fragment = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}${fragment}`;
}

export async function fetchAgentScan(
  sequence: number,
  options: { expiresInSeconds?: number } = {},
): Promise<AgentScan> {
  try {
    const url = new URL("/api/agent-scan", window.location.origin);
    url.searchParams.set("sequence", String(sequence));
    if (options.expiresInSeconds !== undefined) {
      url.searchParams.set("expiresInSeconds", String(options.expiresInSeconds));
    }

    const response = await fetch(url, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Agent scan failed with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      agentRuntime?: string;
      fallback?: boolean;
      signal: AgentScan;
    };
    return {
      ...payload.signal,
      agentRuntime: payload.agentRuntime,
      fallback: payload.fallback,
    };
  } catch {
    return generateAgentScan({ sequence, expiresInSeconds: options.expiresInSeconds });
  }
}

export async function fetchChainState(account?: Address): Promise<ChainState> {
  const url = new URL("/api/chain-state", window.location.origin);
  if (account) {
    url.searchParams.set("account", account);
  }

  const response = await fetch(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Chain state failed with ${response.status}.`);
  }

  return response.json() as Promise<ChainState>;
}

export function shortHash(hash?: string): string {
  if (!hash) return "0x";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  return "Transaction failed.";
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(
      /https:\/\/rpc\.testnet\.arc-node\.thecanteenapp\.com\/v1\/[A-Za-z0-9_-]+/g,
      "[Arc RPC endpoint]",
    )
    .replace(/swrm_[A-Za-z0-9_-]+/g, "[Arc RPC token]");
}

export function withWalletTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return withTimeout(
    promise,
    WALLET_REQUEST_TIMEOUT_MS,
    `${label} timed out. Check your wallet for a stale request, reject it if needed, then try again.`,
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => globalThis.clearTimeout(timeout));
  });
}
