import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  directionToContractValue,
  generateAgentScan,
  type AgentScan,
} from "../app/lib/agent-scan";
import {
  arcCanteen,
  demoUsdcAddress,
  erc20Abi,
  signalBondAbi,
  signalBondAddress,
} from "../app/lib/contract";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const forceSeed = process.env.FORCE_DEMO_SEED === "1";

if (!privateKey) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY to seed demo signals.");
}

if (!signalBondAddress || !demoUsdcAddress) {
  throw new Error("Set NEXT_PUBLIC_SIGNALBOND_ADDRESS and NEXT_PUBLIC_DEMO_USDC_ADDRESS.");
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

const seedPlan: Array<{
  correct?: boolean;
  expiresInSeconds: number;
  pnlBps?: number;
  sequence: number;
  settle: boolean;
}> = [
  { sequence: 0, expiresInSeconds: 45, settle: true, correct: true, pnlBps: 420 },
  { sequence: 1, expiresInSeconds: 45, settle: true, correct: false, pnlBps: -260 },
  { sequence: 2, expiresInSeconds: 86_400, settle: false },
  { sequence: 3, expiresInSeconds: 86_400, settle: false },
  { sequence: 4, expiresInSeconds: 86_400, settle: false },
  { sequence: 5, expiresInSeconds: 86_400, settle: false },
];

const currentNextSignalId = await publicClient.readContract({
  address: signalBondAddress,
  abi: signalBondAbi,
  functionName: "nextSignalId",
});

if (currentNextSignalId > 1n && !forceSeed) {
  console.log(
    JSON.stringify(
      {
        status: "skipped",
        reason: "SignalBond already has signals. Set FORCE_DEMO_SEED=1 to append another batch.",
        signalCount: Number(currentNextSignalId) - 1,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const requiredStake = seedPlan.reduce(
  (sum, plan) =>
    sum + parseUnits(String(generateAgentScan({ sequence: plan.sequence }).stakeUsdc), 6),
  0n,
);
const balance = await publicClient.readContract({
  address: demoUsdcAddress,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});

if (balance < requiredStake) {
  throw new Error(
    `Insufficient demo USDC. Need ${formatUnits(requiredStake, 6)}, have ${formatUnits(balance, 6)}.`,
  );
}

console.log(
  `Seeding SignalBond from ${account.address} with ${formatUnits(requiredStake, 6)} demo USDC stake.`,
);

const created: Array<{
  agentId: string;
  createTx: Hex;
  market: string;
  resolveTx?: Hex;
  signalId: number;
}> = [];

for (const [index, plan] of seedPlan.entries()) {
  const latestBlock = await publicClient.getBlock();
  const scan = generateAgentScan({
    expiresInSeconds: plan.expiresInSeconds,
    now: new Date((Number(latestBlock.timestamp) + index) * 1000),
    salt: "signalbond-demo-seed-v1",
    sequence: plan.sequence,
  });
  const signalId = await publicClient.readContract({
    address: signalBondAddress,
    abi: signalBondAbi,
    functionName: "nextSignalId",
  });

  const stakeAmount = parseUnits(String(scan.stakeUsdc), 6);
  const approveHash = await walletClient.writeContract({
    address: demoUsdcAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [signalBondAddress, stakeAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const createTx = await createSignal(scan, stakeAmount);
  await publicClient.waitForTransactionReceipt({ hash: createTx });
  created.push({
    agentId: scan.agentId,
    createTx,
    market: scan.market,
    signalId: Number(signalId),
  });
  console.log(`Created signal #${signalId}: ${scan.market} (${createTx})`);
}

const settleAfterMs = Math.max(
  ...seedPlan.filter((plan) => plan.settle).map((plan) => plan.expiresInSeconds * 1000),
  0,
);

if (settleAfterMs > 0) {
  await new Promise((resolve) => setTimeout(resolve, settleAfterMs + 2500));
}

for (const [index, plan] of seedPlan.entries()) {
  if (!plan.settle) continue;

  const signal = created[index];
  const resolveTx = await walletClient.writeContract({
    address: signalBondAddress,
    abi: signalBondAbi,
    functionName: "resolveSignal",
    args: [BigInt(signal.signalId), Boolean(plan.correct), BigInt(plan.pnlBps ?? 0)],
  });
  await publicClient.waitForTransactionReceipt({ hash: resolveTx });
  signal.resolveTx = resolveTx;
  console.log(`Resolved signal #${signal.signalId}: ${resolveTx}`);
}

const nextSignalId = await publicClient.readContract({
  address: signalBondAddress,
  abi: signalBondAbi,
  functionName: "nextSignalId",
});
const finalBalance = await publicClient.readContract({
  address: demoUsdcAddress,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});

console.log(
  JSON.stringify(
    {
      status: "seeded",
      signalCount: Number(nextSignalId) - 1,
      deployer: account.address,
      deployerDemoUsdc: formatUnits(finalBalance, 6),
      created,
    },
    null,
    2,
  ),
);

async function createSignal(scan: AgentScan, stakeAmount: bigint): Promise<Hex> {
  return walletClient.writeContract({
    address: signalBondAddress as Address,
    abi: signalBondAbi,
    functionName: "createSignal",
    args: [
      keccak256(stringToHex(scan.agentId)),
      scan.market,
      directionToContractValue(scan.direction),
      scan.confidenceBps,
      stakeAmount,
      BigInt(Math.floor(new Date(scan.expiresAt).getTime() / 1000)),
      scan.sourceHash,
      keccak256(stringToHex(scan.reasoning)),
    ],
  });
}
