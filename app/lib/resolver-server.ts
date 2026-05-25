import "server-only";
import {
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcCanteen, signalBondAbi, signalBondAddress } from "./contract";
import { getPublicClient } from "./onchain";

/**
 * Server-side resolver wallet. The contract's `onlyResolver` modifier accepts
 * either the deployer or any address set via `setResolver`. To keep the demo
 * end-to-end working without manual button-mashing, we hold a dedicated
 * resolver private key in `RESOLVER_PRIVATE_KEY` (or fall back to the deploy
 * key if the user reused it). Loaded inside the function so import-time builds
 * never throw on missing env in CI.
 */

function readResolverKey(): Hex | undefined {
  const raw =
    process.env.RESOLVER_PRIVATE_KEY ??
    process.env.SIGNALBOND_DEPLOY_KEY ??
    undefined;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

export function resolverConfigured(): boolean {
  return Boolean(readResolverKey() && signalBondAddress);
}

export function resolverAddress(): Address | undefined {
  const key = readResolverKey();
  if (!key) return undefined;
  try {
    return privateKeyToAccount(key).address;
  } catch {
    return undefined;
  }
}

export async function resolverRoleAddresses(): Promise<Address[]> {
  if (!signalBondAddress) return [];

  const publicClient = getPublicClient();
  const [owner, resolver] = await Promise.all([
    publicClient.readContract({
      address: signalBondAddress,
      abi: signalBondAbi,
      functionName: "owner",
    }),
    publicClient.readContract({
      address: signalBondAddress,
      abi: signalBondAbi,
      functionName: "resolver",
    }),
  ]);

  return [owner, resolver];
}

export async function submitResolution(
  onchainId: number,
  correct: boolean,
  pnlBps: number,
): Promise<Hex> {
  const key = readResolverKey();
  if (!key) throw new Error("RESOLVER_PRIVATE_KEY is not set.");
  if (!signalBondAddress) throw new Error("SignalBond contract address is not configured.");

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: arcCanteen,
    transport: http(),
  });
  const publicClient = getPublicClient();

  const hash = await wallet.writeContract({
    address: signalBondAddress,
    abi: signalBondAbi,
    functionName: "resolveSignal",
    args: [BigInt(onchainId), correct, BigInt(pnlBps)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 45_000 });
  if (receipt.status === "reverted") {
    throw new Error(`resolveSignal reverted for signal #${onchainId}`);
  }

  return hash;
}
