import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcCanteen } from "../app/lib/contract";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const signalBond = (
  process.env.SIGNALBOND_ADDRESS ?? process.env.NEXT_PUBLIC_SIGNALBOND_ADDRESS
) as Address | undefined;
const stakeToken = (process.env.STAKE_TOKEN_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as Address;

if (!privateKey || !signalBond) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY and SIGNALBOND_ADDRESS.");
}

const account = privateKeyToAccount(privateKey);

const publicClient = createPublicClient({
  chain: arcCanteen,
  transport: http(),
});
const walletClient = createWalletClient({
  account,
  chain: arcCanteen,
  transport: http(),
});

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const signalBondAbi = parseAbi([
  "function createSignal(bytes32 agentId,string market,uint8 direction,uint16 confidenceBps,uint256 stakeAmount,uint64 expiresAt,uint256 entryPriceE8,uint256 targetPriceE8,bytes32 sourceDataHash,bytes32 explanationHash) returns (uint256)",
  "function nextSignalId() view returns (uint256)",
]);

const now = Math.floor(Date.now() / 1000);
const scenarios = [
  {
    agentId: "macro-sentinel",
    market: "BTC",
    direction: 0,
    confidenceBps: 6200,
    stakeUsdc: "2",
    entryPrice: 106_420,
    targetPrice: 108_900,
    expiresInSeconds: 3 * 60 * 60,
    thesis: "BTC momentum remains firm while dollar liquidity is stable and spot breadth is improving.",
  },
  {
    agentId: "tape-reader",
    market: "SOL",
    direction: 0,
    confidenceBps: 5900,
    stakeUsdc: "2",
    entryPrice: 182.1,
    targetPrice: 192,
    expiresInSeconds: 2 * 60 * 60,
    thesis: "SOL breadth and high-beta rotation improved after funding normalized across majors.",
  },
  {
    agentId: "arb-cartographer",
    market: "USDC",
    direction: 2,
    confidenceBps: 6400,
    stakeUsdc: "2",
    entryPrice: 1,
    targetPrice: 1.0005,
    expiresInSeconds: 90 * 60,
    thesis: "Stablecoin route spreads should remain inside profitable bounds after Arc settlement fees.",
  },
] as const;

const totalStake = scenarios.reduce(
  (sum, scenario) => sum + parseUnits(scenario.stakeUsdc, 6),
  0n,
);

const balance = await publicClient.readContract({
  address: stakeToken,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});
if (balance < totalStake) {
  throw new Error(`Insufficient USDC balance to seed ${scenarios.length} signals.`);
}

const allowance = await publicClient.readContract({
  address: stakeToken,
  abi: erc20Abi,
  functionName: "allowance",
  args: [account.address, signalBond],
});
if (allowance < totalStake) {
  const approveHash = await walletClient.writeContract({
    address: stakeToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [signalBond, totalStake],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (receipt.status === "reverted") {
    throw new Error("USDC approval reverted.");
  }
}

const txs: Hex[] = [];
for (const [index, scenario] of scenarios.entries()) {
  const sourcePayload = JSON.stringify({
    seed: "signalbond-demo-seed-v2",
    index,
    ...scenario,
  });
  const hash = await walletClient.writeContract({
    address: signalBond,
    abi: signalBondAbi,
    functionName: "createSignal",
    args: [
      agentHash(scenario.agentId),
      scenario.market,
      scenario.direction,
      scenario.confidenceBps,
      parseUnits(scenario.stakeUsdc, 6),
      BigInt(now + scenario.expiresInSeconds),
      priceToUnits(scenario.entryPrice),
      priceToUnits(scenario.targetPrice),
      keccak256(stringToHex(sourcePayload)),
      keccak256(stringToHex(scenario.thesis)),
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`Seed signal ${index + 1} reverted.`);
  }
  txs.push(hash);
}

const nextSignalId = await publicClient.readContract({
  address: signalBond,
  abi: signalBondAbi,
  functionName: "nextSignalId",
});

console.log(
  JSON.stringify(
    {
      signalBond,
      seeded: txs.length,
      nextSignalId: nextSignalId.toString(),
      txs,
    },
    null,
    2,
  ),
);

function agentHash(agentId: string): Hex {
  return keccak256(stringToHex(agentId));
}

function priceToUnits(value: number): bigint {
  return parseUnits(value.toFixed(8), 8);
}
