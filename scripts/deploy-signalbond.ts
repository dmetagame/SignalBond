import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcCanteen } from "../app/lib/contract";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const stakeToken = process.env.STAKE_TOKEN_ADDRESS as Hex | undefined;
const resolver = (process.env.RESOLVER_ADDRESS ?? process.env.DEPLOYER_ADDRESS) as Hex | undefined;

if (!privateKey || !stakeToken || !resolver) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY, STAKE_TOKEN_ADDRESS, and RESOLVER_ADDRESS.");
}

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({
  chain: arcCanteen,
  transport: http(),
});
const client = createWalletClient({
  account,
  chain: arcCanteen,
  transport: http(),
});

const abi = parseAbi(["constructor(address stakeToken_, address resolver_)"]);
const bytecode = readFileSync("build/contracts/contracts_SignalBond_sol_SignalBond.bin", "utf8");

const hash = await client.deployContract({
  abi,
  bytecode: `0x${bytecode}`,
  args: [stakeToken, resolver],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });

console.log(
  JSON.stringify(
    { deployer: account.address, txHash: hash, signalBond: receipt.contractAddress },
    null,
    2,
  ),
);
