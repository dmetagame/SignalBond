import { defineChain, isAddress, type Address } from "viem";

const publicArcRpcUrl = "https://rpc.testnet.arc.network";
const arcRpcUrl =
  typeof window === "undefined"
    ? process.env.ARC_RPC_URL ?? publicArcRpcUrl
    : publicArcRpcUrl;

export const arcCanteen = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 5_042_002),
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [arcRpcUrl],
    },
  },
});

export const signalBondAddress = readAddress(process.env.NEXT_PUBLIC_SIGNALBOND_ADDRESS);

/**
 * USDC on Arc Testnet is the native gas asset and is exposed as an
 * ERC20-compatible system contract at 0x3600…0000. We default to that so the
 * stake token matches what users hold from the Circle faucet (and what CCTP
 * mints on the destination side). `NEXT_PUBLIC_USDC_ADDRESS` and the legacy
 * `NEXT_PUBLIC_DEMO_USDC_ADDRESS` are both honored for backward compatibility.
 */
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as Address;
export const usdcAddress: Address =
  readAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS) ??
  readAddress(process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS) ??
  ARC_TESTNET_USDC;

/** Legacy alias retained so existing imports keep working during the swap. */
export const demoUsdcAddress = usdcAddress;
export const contractsConfigured = Boolean(signalBondAddress);

export const faucetUrl = "https://faucet.circle.com";

export const signalBondAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "nextSignalId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createSignal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "market", type: "string" },
      { name: "direction", type: "uint8" },
      { name: "confidenceBps", type: "uint16" },
      { name: "stakeAmount", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
      { name: "sourceDataHash", type: "bytes32" },
      { name: "explanationHash", type: "bytes32" },
    ],
    outputs: [{ name: "signalId", type: "uint256" }],
  },
  {
    type: "function",
    name: "resolveSignal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signalId", type: "uint256" },
      { name: "correct", type: "bool" },
      { name: "pnlBps", type: "int256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getSignal",
    stateMutability: "view",
    inputs: [{ name: "signalId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "agentId", type: "bytes32" },
          { name: "publisher", type: "address" },
          { name: "direction", type: "uint8" },
          { name: "market", type: "string" },
          { name: "confidenceBps", type: "uint16" },
          { name: "createdAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "stakeAmount", type: "uint256" },
          { name: "sourceDataHash", type: "bytes32" },
          { name: "explanationHash", type: "bytes32" },
          { name: "resolved", type: "bool" },
          { name: "correct", type: "bool" },
          { name: "pnlBps", type: "int256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getScore",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "resolvedSignals", type: "uint256" },
          { name: "correctSignals", type: "uint256" },
          { name: "reputation", type: "int256" },
          { name: "cumulativePnLBps", type: "int256" },
          { name: "updatedAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export const erc20Abi = [
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function readAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? value : undefined;
}
