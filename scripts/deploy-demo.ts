import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcCanteen } from "../app/lib/contract";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const stakeToken = (process.env.STAKE_TOKEN_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as Address;

if (!privateKey) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY to deploy SignalBond on Arc.");
}

const account = privateKeyToAccount(privateKey);
const resolver = (process.env.RESOLVER_ADDRESS ?? account.address) as Address;

const publicClient = createPublicClient({
  chain: arcCanteen,
  transport: http(),
});
const walletClient = createWalletClient({
  account,
  chain: arcCanteen,
  transport: http(),
});

const signalBondAbi = parseAbi(["constructor(address stakeToken_, address resolver_)"]);
const signalBondBytecode = readBytecode("build/contracts/contracts_SignalBond_sol_SignalBond.bin");

console.log(`Deploying from ${account.address} on ${arcCanteen.name} (${arcCanteen.id})`);
console.log(`  stakeToken = ${stakeToken}`);
console.log(`  resolver   = ${resolver}`);

const signalBondHash = await walletClient.deployContract({
  abi: signalBondAbi,
  bytecode: signalBondBytecode,
  args: [stakeToken, resolver],
});
console.log(`SignalBond tx: ${signalBondHash}`);
const signalBondReceipt = await publicClient.waitForTransactionReceipt({ hash: signalBondHash });
const signalBond = signalBondReceipt.contractAddress;
if (!signalBond) {
  throw new Error("SignalBond deployment did not return a contract address.");
}

console.log(
  JSON.stringify(
    {
      deployer: account.address,
      chainId: arcCanteen.id,
      rpcConfigured: Boolean(process.env.ARC_RPC_URL),
      stakeToken,
      resolver,
      signalBond,
      vercelEnv: {
        NEXT_PUBLIC_USDC_ADDRESS: stakeToken,
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
