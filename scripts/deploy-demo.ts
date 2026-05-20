import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcCanteen } from "../app/lib/contract";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;

if (!privateKey) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY to deploy the demo contracts.");
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

const mockUsdcAbi = parseAbi([
  "constructor(address initialRecipient, uint256 initialSupply)",
  "function balanceOf(address) view returns (uint256)",
]);
const signalBondAbi = parseAbi(["constructor(address stakeToken_, address resolver_)"]);

const mockUsdcBytecode = readBytecode("build/contracts/contracts_MockUSDC_sol_MockUSDC.bin");
const signalBondBytecode = readBytecode("build/contracts/contracts_SignalBond_sol_SignalBond.bin");

console.log(`Deploying from ${account.address} on ${arcCanteen.name} (${arcCanteen.id})`);

const mockHash = await walletClient.deployContract({
  abi: mockUsdcAbi,
  bytecode: mockUsdcBytecode,
  args: [account.address, parseUnits("1000000", 6)],
});
console.log(`MockUSDC tx: ${mockHash}`);
const mockReceipt = await publicClient.waitForTransactionReceipt({ hash: mockHash });
const mockUsdc = mockReceipt.contractAddress;
if (!mockUsdc) {
  throw new Error("MockUSDC deployment did not return a contract address.");
}

const signalBondHash = await walletClient.deployContract({
  abi: signalBondAbi,
  bytecode: signalBondBytecode,
  args: [mockUsdc, account.address],
});
console.log(`SignalBond tx: ${signalBondHash}`);
const signalBondReceipt = await publicClient.waitForTransactionReceipt({ hash: signalBondHash });
const signalBond = signalBondReceipt.contractAddress;
if (!signalBond) {
  throw new Error("SignalBond deployment did not return a contract address.");
}

const deployerBalance = await publicClient.readContract({
  address: mockUsdc,
  abi: mockUsdcAbi,
  functionName: "balanceOf",
  args: [account.address],
});

console.log(
  JSON.stringify(
    {
      deployer: account.address,
      chainId: arcCanteen.id,
      rpcConfigured: Boolean(process.env.ARC_RPC_URL),
      mockUsdc,
      signalBond,
      deployerDemoUsdc: formatUnits(deployerBalance, 6),
      vercelEnv: {
        NEXT_PUBLIC_DEMO_USDC_ADDRESS: mockUsdc,
        NEXT_PUBLIC_SIGNALBOND_ADDRESS: signalBond,
        NEXT_PUBLIC_ARC_CHAIN_ID: String(arcCanteen.id),
      },
    },
    null,
    2,
  ),
);

function readBytecode(path: string): Hex {
  return `0x${readFileSync(path, "utf8").trim()}`;
}
