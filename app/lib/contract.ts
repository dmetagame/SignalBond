import { defineChain } from "viem";

export const arcCanteen = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 504_520),
  name: "Arc Canteen Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://arc-node.thecanteenapp.com/rpc"],
    },
  },
});

export const signalBondAbi = [
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
