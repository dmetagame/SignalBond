import {
  createPublicClient,
  formatUnits,
  http,
  keccak256,
  parseAbiItem,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import type { Agent, Direction, Signal } from "./types";
import {
  arcCanteen,
  demoUsdcAddress,
  erc20Abi,
  signalBondAbi,
  signalBondAddress,
} from "./contract";
import { getWalletPublicClient, hasInjectedWallet } from "./wallet-provider";

const MAX_SIGNALS_TO_READ = 40;
const LOG_LOOKBACK_BLOCKS = 250_000n;
const LOG_CHUNK_BLOCKS = 9_999n;
const TX_CONFIRMATION_TIMEOUT_MS = 45_000;

const signalCreatedEvent = parseAbiItem(
  "event SignalCreated(uint256 indexed signalId, bytes32 indexed agentId, address indexed publisher, string market, uint8 direction, uint16 confidenceBps, uint256 stakeAmount, uint64 expiresAt, uint256 entryPriceE8, uint256 targetPriceE8, bytes32 sourceDataHash, bytes32 explanationHash)",
);
const signalResolvedEvent = parseAbiItem(
  "event SignalResolved(uint256 indexed signalId, bytes32 indexed agentId, bool correct, int256 pnlBps, int256 reputation)",
);

type ContractSignal = {
  id: bigint;
  agentId: Hex;
  publisher: Address;
  direction: number;
  market: string;
  confidenceBps: number;
  createdAt: bigint;
  expiresAt: bigint;
  stakeAmount: bigint;
  entryPriceE8: bigint;
  targetPriceE8: bigint;
  sourceDataHash: Hex;
  explanationHash: Hex;
  resolved: boolean;
  correct: boolean;
  pnlBps: bigint;
};

type ContractScore = {
  resolvedSignals: bigint;
  correctSignals: bigint;
  reputation: bigint;
  cumulativePnLBps: bigint;
  updatedAt: bigint;
};

export type OnchainDashboard = {
  agents: Agent[];
  blockNumber: bigint;
  owner: Address;
  resolver: Address;
  treasury: Address;
  signalCount: number;
  signals: Signal[];
  slashedStakeUsdc: number;
  walletBalanceUsdc?: number;
};

export function getPublicClient() {
  return createPublicClient({
    chain: arcCanteen,
    transport: http(),
  });
}

export function agentHash(agentId: string): Hex {
  return keccak256(stringToHex(agentId));
}

export async function waitForOnchainTx(hash: Hex) {
  const publicClient = hasInjectedWallet() ? getWalletPublicClient() : getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: TX_CONFIRMATION_TIMEOUT_MS,
  });

  if (receipt.status === "reverted") {
    throw new Error("Transaction reverted on Arc. Check the wallet activity for details.");
  }

  return receipt;
}

export async function readOnchainDashboard(
  seedAgents: Agent[],
  account?: Address,
): Promise<OnchainDashboard> {
  const bondAddress = signalBondAddress;
  const tokenAddress = demoUsdcAddress;

  if (!bondAddress || !tokenAddress) {
    throw new Error("Contract addresses are not configured.");
  }

  const publicClient = getPublicClient();
  const agentHashes = new Map(seedAgents.map((agent) => [agentHash(agent.id), agent.id]));

  const [nextSignalId, blockNumber, owner, resolver, walletBalance, scores] =
    await Promise.all([
      publicClient.readContract({
        address: bondAddress,
        abi: signalBondAbi,
        functionName: "nextSignalId",
      }),
      publicClient.getBlockNumber(),
      publicClient.readContract({
        address: bondAddress,
        abi: signalBondAbi,
        functionName: "owner",
      }),
      publicClient.readContract({
        address: bondAddress,
        abi: signalBondAbi,
        functionName: "resolver",
      }),
      account
        ? publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
          })
        : Promise.resolve(undefined),
      Promise.all(
        seedAgents.map((agent) =>
          publicClient.readContract({
            address: bondAddress,
            abi: signalBondAbi,
            functionName: "getScore",
            args: [agentHash(agent.id)],
          }),
        ),
      ),
    ]);

  const [treasury, slashedStakeBalance] = await Promise.all([
    publicClient
      .readContract({
        address: bondAddress,
        abi: signalBondAbi,
        functionName: "treasury",
      })
      .catch(() => owner),
    publicClient
      .readContract({
        address: bondAddress,
        abi: signalBondAbi,
        functionName: "slashedStakeBalance",
      })
      .catch(() => 0n),
  ]);

  const latestSignalId = Math.max(0, Number(nextSignalId) - 1);
  const firstSignalId = Math.max(1, latestSignalId - MAX_SIGNALS_TO_READ + 1);
  const logFromBlock =
    blockNumber > LOG_LOOKBACK_BLOCKS ? blockNumber - LOG_LOOKBACK_BLOCKS : 0n;
  const ids =
    latestSignalId === 0
      ? []
      : Array.from(
          { length: latestSignalId - firstSignalId + 1 },
          (_, index) => BigInt(firstSignalId + index),
        );

  const [rawSignals, createdLogs] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: bondAddress,
          abi: signalBondAbi,
          functionName: "getSignal",
          args: [id],
        }),
      ),
    ),
    readSignalCreatedLogs(publicClient, bondAddress, {
      fromBlock: logFromBlock,
      latestSignalId,
      minimumSignalId: firstSignalId,
      toBlock: blockNumber,
    }),
  ]);
  const contractSignals = rawSignals.map(toContractSignal);
  const settledSignalIds = contractSignals
    .filter((signal) => signal.resolved)
    .map((signal) => Number(signal.id));
  const resolvedLogs = await readSignalResolvedLogs(publicClient, bondAddress, {
    fromBlock: logFromBlock,
    requiredSignalIds: settledSignalIds,
    toBlock: blockNumber,
  });

  const txBySignalId = new Map<number, Hex>();
  for (const log of createdLogs) {
    const signalId = log.args.signalId;
    if (signalId !== undefined) {
      txBySignalId.set(Number(signalId), log.transactionHash);
    }
  }
  const settlementTxBySignalId = new Map<number, Hex>();
  for (const log of resolvedLogs) {
    const signalId = log.args.signalId;
    if (signalId !== undefined) {
      settlementTxBySignalId.set(Number(signalId), log.transactionHash);
    }
  }

  const signals = contractSignals
    .map((signal) =>
      contractSignalToSignal(
        signal,
        agentHashes,
        txBySignalId,
        settlementTxBySignalId,
      ),
    )
    .sort((a, b) => (b.onchainId ?? 0) - (a.onchainId ?? 0));

  const stakeByAgent = new Map<string, number>();
  const calibrationByAgent = new Map<string, { count: number; totalError: number }>();
  const drawdownByAgent = new Map<string, number>();

  for (const signal of signals) {
    stakeByAgent.set(
      signal.agentId,
      (stakeByAgent.get(signal.agentId) ?? 0) + signal.stakeUsdc,
    );

    if (signal.status === "settled") {
      const realizedProbability = signal.correct ? 10_000 : 0;
      const existing = calibrationByAgent.get(signal.agentId) ?? { count: 0, totalError: 0 };
      calibrationByAgent.set(signal.agentId, {
        count: existing.count + 1,
        totalError: existing.totalError + Math.abs(signal.confidenceBps - realizedProbability),
      });
      drawdownByAgent.set(
        signal.agentId,
        Math.min(drawdownByAgent.get(signal.agentId) ?? 0, signal.pnlBps ?? 0),
      );
    }
  }

  return {
    agents: seedAgents.map((agent, index) => {
      const score = toContractScore(scores[index]);
      const calibration = calibrationByAgent.get(agent.id);

      return {
        ...agent,
        stakedUsdc: stakeByAgent.get(agent.id) ?? 0,
        resolvedSignals: Number(score.resolvedSignals),
        correctSignals: Number(score.correctSignals),
        cumulativePnlBps: Number(score.cumulativePnLBps),
        calibrationBps: calibration
          ? Math.round(calibration.totalError / calibration.count)
          : 0,
        maxDrawdownBps: drawdownByAgent.get(agent.id) ?? 0,
      };
    }),
    blockNumber,
    owner,
    resolver,
    treasury,
    signalCount: latestSignalId,
    signals,
    slashedStakeUsdc: Number(formatUnits(slashedStakeBalance, 6)),
    walletBalanceUsdc:
      walletBalance === undefined ? undefined : Number(formatUnits(walletBalance, 6)),
  };
}

function contractSignalToSignal(
  signal: ContractSignal,
  agentHashes: Map<Hex, string>,
  txBySignalId: Map<number, Hex>,
  settlementTxBySignalId: Map<number, Hex>,
): Signal {
  const id = Number(signal.id);
  const knownAgentId = agentHashes.get(signal.agentId);
  const createdAt = new Date(Number(signal.createdAt) * 1000).toISOString();
  const expiresAt = new Date(Number(signal.expiresAt) * 1000).toISOString();

  return {
    id: `chain-${id}`,
    onchainId: id,
    agentId: knownAgentId ?? signal.agentId,
    market: signal.market,
    venue: "Arc settlement",
    direction: contractToDirection(signal.direction),
    confidenceBps: Number(signal.confidenceBps),
    stakeUsdc: Number(formatUnits(signal.stakeAmount, 6)),
    entryPrice: Number(formatUnits(signal.entryPriceE8, 8)),
    targetPrice: Number(formatUnits(signal.targetPriceE8, 8)),
    createdAt,
    expiresAt,
    status: signal.resolved ? "settled" : "active",
    pnlBps: signal.resolved ? Number(signal.pnlBps) : undefined,
    correct: signal.resolved ? signal.correct : undefined,
    sourceHash: signal.sourceDataHash,
    txHash: txBySignalId.get(id) ?? signal.sourceDataHash,
    settlementTxHash: signal.resolved ? settlementTxBySignalId.get(id) : undefined,
    publisher: signal.publisher,
    reasoning:
      "This signal is loaded from SignalBond contract storage. Source data and thesis hashes are anchored on Arc for auditability.",
    sources: ["signalbond-contract", "arc-event-log"],
  };
}

async function readSignalCreatedLogs(
  publicClient: ReturnType<typeof getPublicClient>,
  bondAddress: Address,
  {
    fromBlock,
    latestSignalId,
    minimumSignalId,
    toBlock,
  }: {
    fromBlock: bigint;
    latestSignalId: number;
    minimumSignalId: number;
    toBlock: bigint;
  },
) {
  if (latestSignalId === 0) {
    return [];
  }

  const logs: Array<{
    args: { signalId?: bigint };
    transactionHash: Hex;
  }> = [];
  const requiredIds = new Set(
    Array.from(
      { length: latestSignalId - minimumSignalId + 1 },
      (_, index) => minimumSignalId + index,
    ),
  );

  let chunkToBlock = toBlock;
  while (chunkToBlock >= fromBlock) {
    const chunkFromBlock =
      chunkToBlock > LOG_CHUNK_BLOCKS ? chunkToBlock - LOG_CHUNK_BLOCKS : 0n;
    const boundedFromBlock = chunkFromBlock < fromBlock ? fromBlock : chunkFromBlock;
    const chunk = await publicClient.getLogs({
      address: bondAddress,
      event: signalCreatedEvent,
      fromBlock: boundedFromBlock,
      toBlock: chunkToBlock,
    });
    logs.push(...chunk);

    for (const log of chunk) {
      const signalId = log.args.signalId;
      if (signalId !== undefined) {
        requiredIds.delete(Number(signalId));
      }
    }
    if (requiredIds.size === 0 || boundedFromBlock === 0n) {
      break;
    }

    chunkToBlock = boundedFromBlock - 1n;
  }

  return logs;
}

async function readSignalResolvedLogs(
  publicClient: ReturnType<typeof getPublicClient>,
  bondAddress: Address,
  {
    fromBlock,
    requiredSignalIds,
    toBlock,
  }: {
    fromBlock: bigint;
    requiredSignalIds: number[];
    toBlock: bigint;
  },
) {
  if (requiredSignalIds.length === 0) {
    return [];
  }

  const logs: Array<{
    args: { signalId?: bigint };
    transactionHash: Hex;
  }> = [];
  const pendingIds = new Set(requiredSignalIds);

  let chunkToBlock = toBlock;
  while (chunkToBlock >= fromBlock) {
    const chunkFromBlock =
      chunkToBlock > LOG_CHUNK_BLOCKS ? chunkToBlock - LOG_CHUNK_BLOCKS : 0n;
    const boundedFromBlock = chunkFromBlock < fromBlock ? fromBlock : chunkFromBlock;
    const chunk = await publicClient.getLogs({
      address: bondAddress,
      event: signalResolvedEvent,
      fromBlock: boundedFromBlock,
      toBlock: chunkToBlock,
    });
    logs.push(...chunk);

    for (const log of chunk) {
      const signalId = log.args.signalId;
      if (signalId !== undefined) {
        pendingIds.delete(Number(signalId));
      }
    }
    if (pendingIds.size === 0 || boundedFromBlock === 0n) {
      break;
    }

    chunkToBlock = boundedFromBlock - 1n;
  }

  return logs;
}

function contractToDirection(direction: number): Direction {
  switch (direction) {
    case 0:
      return "LONG";
    case 1:
      return "SHORT";
    case 2:
      return "YES";
    case 3:
      return "NO";
    default:
      return "YES";
  }
}

function toContractSignal(raw: unknown): ContractSignal {
  const tuple = raw as Record<string, unknown> & readonly unknown[];

  return {
    id: readTupleValue<bigint>(tuple, "id", 0),
    agentId: readTupleValue<Hex>(tuple, "agentId", 1),
    publisher: readTupleValue<Address>(tuple, "publisher", 2),
    direction: Number(readTupleValue<number | bigint>(tuple, "direction", 3)),
    market: readTupleValue<string>(tuple, "market", 4),
    confidenceBps: Number(readTupleValue<number | bigint>(tuple, "confidenceBps", 5)),
    createdAt: readTupleValue<bigint>(tuple, "createdAt", 6),
    expiresAt: readTupleValue<bigint>(tuple, "expiresAt", 7),
    stakeAmount: readTupleValue<bigint>(tuple, "stakeAmount", 8),
    entryPriceE8: readTupleValue<bigint>(tuple, "entryPriceE8", 9) ?? 100_000_000n,
    targetPriceE8: readTupleValue<bigint>(tuple, "targetPriceE8", 10) ?? 100_000_000n,
    sourceDataHash: readTupleValue<Hex>(tuple, "sourceDataHash", 11),
    explanationHash: readTupleValue<Hex>(tuple, "explanationHash", 12),
    resolved: readTupleValue<boolean>(tuple, "resolved", 13),
    correct: readTupleValue<boolean>(tuple, "correct", 14),
    pnlBps: readTupleValue<bigint>(tuple, "pnlBps", 15),
  };
}

function toContractScore(raw: unknown): ContractScore {
  const tuple = raw as Record<string, unknown> & readonly unknown[];

  return {
    resolvedSignals: readTupleValue<bigint>(tuple, "resolvedSignals", 0),
    correctSignals: readTupleValue<bigint>(tuple, "correctSignals", 1),
    reputation: readTupleValue<bigint>(tuple, "reputation", 2),
    cumulativePnLBps: readTupleValue<bigint>(tuple, "cumulativePnLBps", 3),
    updatedAt: readTupleValue<bigint>(tuple, "updatedAt", 4),
  };
}

function readTupleValue<T>(
  tuple: Record<string, unknown> & readonly unknown[],
  key: string,
  index: number,
): T {
  return (tuple[key] ?? tuple[index]) as T;
}
