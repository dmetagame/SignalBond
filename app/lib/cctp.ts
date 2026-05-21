import { sepolia } from "viem/chains";
import type { Address, Hex } from "viem";

/**
 * Circle CCTP V2 configuration for SignalBond's bridge flow.
 *
 * The bridge uses Circle's forwarder service hook so a single Sepolia
 * transaction (depositForBurnWithHook + the magic "cctp-forward" hook) is
 * enough — Circle observes the burn, fetches an attestation, and mints the
 * USDC on Arc Testnet automatically. The frontend polls the Iris attestation
 * API only to surface progress; it never has to sign on the Arc side.
 */

export const cctpV2 = {
  tokenMessengerAddress: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
  messageTransmitterAddress: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address,
  irisBaseUrl: "https://iris-api-sandbox.circle.com",
  forwarderHook:
    "0x636374702d666f72776172640000000000000000000000000000000000000000" as Hex,
} as const;

export const sepoliaChain = sepolia;

export const sepoliaUsdcAddress =
  "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as Address;

export const sourceDomains = {
  ethereumSepolia: 0,
} as const;

export const destinationDomains = {
  arcTestnet: 26,
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
