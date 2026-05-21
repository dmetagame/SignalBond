import { baseSepolia, sepolia } from "viem/chains";
import { createPublicClient, http, type Address, type Chain } from "viem";
import { arcCanteen, usdcAddress as arcUsdc } from "./contract";
import { erc20Abi } from "./contract";

export type UnifiedChainEntry = {
  id: string;
  name: string;
  shortName: string;
  chainId: number;
  usdcAddress: Address;
  isGatewayChain: boolean;
};

/**
 * Chains SignalBond surfaces in the unified-balance view. The flag matches
 * Circle Gateway's testnet support set; the Arc row is included as the
 * destination of the bridge so users always see where their staked USDC
 * lands.
 */
export const unifiedChains: (UnifiedChainEntry & { chain: Chain })[] = [
  {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    chainId: sepolia.id,
    chain: sepolia,
    usdcAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as Address,
    isGatewayChain: true,
  },
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    shortName: "Base",
    chainId: baseSepolia.id,
    chain: baseSepolia,
    usdcAddress: "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as Address,
    isGatewayChain: true,
  },
  {
    id: "arc-testnet",
    name: "Arc Testnet",
    shortName: "Arc",
    chainId: arcCanteen.id,
    chain: arcCanteen,
    usdcAddress: arcUsdc,
    isGatewayChain: false,
  },
];

export type ChainBalance = {
  entry: UnifiedChainEntry;
  balance: bigint;
  error?: string;
};

export async function readChainUsdc(
  account: Address,
  entry: (typeof unifiedChains)[number],
): Promise<ChainBalance> {
  try {
    const client = createPublicClient({ chain: entry.chain, transport: http() });
    const raw = (await client.readContract({
      address: entry.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
    return { entry, balance: raw };
  } catch (error) {
    return {
      entry,
      balance: 0n,
      error: error instanceof Error ? error.message : "balance lookup failed",
    };
  }
}

export async function readUnifiedUsdc(account: Address): Promise<{
  balances: ChainBalance[];
  total: bigint;
}> {
  const balances = await Promise.all(
    unifiedChains.map((entry) => readChainUsdc(account, entry)),
  );
  const total = balances.reduce((sum, b) => sum + b.balance, 0n);
  return { balances, total };
}
