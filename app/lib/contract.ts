import { defineChain, isAddress, type Address } from "viem";

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
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
  },
});

export const signalBondAddress = readAddress(process.env.NEXT_PUBLIC_SIGNALBOND_ADDRESS);
export const demoUsdcAddress = readAddress(process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS);
export const contractsConfigured = Boolean(signalBondAddress && demoUsdcAddress);

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
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
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
] as const;

function readAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? value : undefined;
}
