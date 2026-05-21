import { sepolia } from "viem/chains";
import type { Address, Hex } from "viem";
import { arcTestnetConfig, ethereumSepoliaConfig } from "./app-kit";

/**
 * Circle CCTP V2 configuration for SignalBond's bridge flow. Contract
 * addresses and domain IDs are sourced from `@circle-fin/app-kit`'s canonical
 * chain definitions so the integration tracks Circle's published numbers
 * exactly.
 *
 * The bridge uses Circle's forwarder service hook so a single Sepolia
 * transaction (depositForBurnWithHook + the magic "cctp-forward" hook) is
 * enough — Circle observes the burn, fetches an attestation, and mints the
 * USDC on Arc Testnet automatically. The frontend polls the Iris attestation
 * API only to surface progress; it never has to sign on the Arc side.
 */

export const cctpV2 = {
  tokenMessengerAddress: ethereumSepoliaConfig.cctp.tokenMessenger,
  messageTransmitterAddress: arcTestnetConfig.cctp.messageTransmitter,
  irisBaseUrl: "https://iris-api-sandbox.circle.com",
  forwarderHook:
    "0x636374702d666f72776172640000000000000000000000000000000000000000" as Hex,
} as const;

export const sepoliaChain = sepolia;

export const sepoliaUsdcAddress: Address = ethereumSepoliaConfig.usdc;

export const sourceDomains = {
  ethereumSepolia: ethereumSepoliaConfig.cctp.domain,
} as const;

export const destinationDomains = {
  arcTestnet: arcTestnetConfig.cctp.domain,
} as const;

/** Default fast-transfer settings per Circle's quickstart. */
export const cctpDefaults = {
  maxFee: 500n, // 0.0005 USDC
  finalityThreshold: 1000, // Fast Transfer
} as const;

export const erc20MinAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const tokenMessengerV2Abi = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "nonce", type: "uint64" }],
  },
] as const;

/** Convert an EVM address to a left-padded bytes32 for CCTP's recipient field. */
export function addressToBytes32(addr: Address): Hex {
  return `0x000000000000000000000000${addr.slice(2).toLowerCase()}` as Hex;
}

export type AttestationStatus = "pending_confirmations" | "complete" | "expired";

export type AttestationResponse = {
  messages?: {
    status?: AttestationStatus;
    attestation?: Hex;
    message?: Hex;
    sourceDomain?: number;
    destinationDomain?: number;
    txHash?: Hex;
  }[];
};

export async function fetchAttestation(
  sourceDomain: number,
  txHash: Hex,
  signal?: AbortSignal,
): Promise<AttestationResponse> {
  const url = `${cctpV2.irisBaseUrl}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;
  const response = await fetch(url, {
    signal,
    cache: "no-store",
  });
  if (response.status === 404) {
    return { messages: [] };
  }
  if (!response.ok) {
    throw new Error(`Iris attestation lookup failed: ${response.status}`);
  }
  return (await response.json()) as AttestationResponse;
}
