"use client";

import {
  ArrowRight,
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import UnifiedBalance from "../../components/dashboard/UnifiedBalance";
import {
  addressToBytes32,
  cctpDefaults,
  cctpV2,
  destinationDomains,
  erc20MinAbi,
  fetchAttestation,
  sepoliaChain,
  sepoliaUsdcAddress,
  sourceDomains,
  tokenMessengerV2Abi,
  type AttestationStatus,
} from "../../lib/cctp";
import { normalizeError } from "../../lib/dashboard-actions";

type BridgeStage =
  | "idle"
  | "switching"
  | "approving"
  | "burning"
  | "polling"
  | "complete"
  | "failed";

const STAGES: { id: BridgeStage; label: string }[] = [
  { id: "switching", label: "Switch to Sepolia" },
  { id: "approving", label: "Approve USDC" },
  { id: "burning", label: "Burn on Sepolia" },
  { id: "polling", label: "Await Circle attestation" },
  { id: "complete", label: "Mint complete on Arc" },
];

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

const SEPOLIA_HEX = `0x${sepoliaChain.id.toString(16)}` as const;

const sepoliaPublic = createPublicClient({
  chain: sepoliaChain,
  transport: http(),
});

function shortHashLocal(hash?: string): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export default function BridgePage() {
  const { walletAddress, connectWallet } = useDashboard();
  const [amount, setAmount] = useState("5");
  const [sepoliaBalance, setSepoliaBalance] = useState<string>("—");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [stage, setStage] = useState<BridgeStage>("idle");
  const [error, setError] = useState<string>();
  const [burnTxHash, setBurnTxHash] = useState<Hex>();
  const [attestationStatus, setAttestationStatus] = useState<AttestationStatus>();
  const [destTxHash, setDestTxHash] = useState<Hex>();

  const refreshSepoliaBalance = useCallback(async () => {
    if (!walletAddress) {
      setSepoliaBalance("—");
      return;
    }
    setBalanceLoading(true);
    try {
      const raw = (await sepoliaPublic.readContract({
        address: sepoliaUsdcAddress,
        abi: erc20MinAbi,
        functionName: "balanceOf",
        args: [walletAddress],
      })) as bigint;
      setSepoliaBalance(`${Number(formatUnits(raw, 6)).toFixed(2)} USDC`);
    } catch {
      setSepoliaBalance("unavailable");
    } finally {
      setBalanceLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void refreshSepoliaBalance();
  }, [refreshSepoliaBalance]);

  const handleBridge = useCallback(async () => {
    setError(undefined);
    setBurnTxHash(undefined);
    setDestTxHash(undefined);
    setAttestationStatus(undefined);

    if (!walletAddress) {
      setError("Connect a wallet first.");
      return;
    }
    if (!window.ethereum) {
      setError("No injected wallet detected.");
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a USDC amount greater than 0.");
      return;
    }
    const amountWei = parseUnits(amount, 6);

    try {
      setStage("switching");
      const currentChain = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      if (currentChain.toLowerCase() !== SEPOLIA_HEX.toLowerCase()) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_HEX }],
          });
        } catch (err) {
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { code?: number }).code === 4902
          ) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: SEPOLIA_HEX,
                  chainName: sepoliaChain.name,
                  nativeCurrency: sepoliaChain.nativeCurrency,
                  rpcUrls: ["https://rpc.sepolia.org"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            throw err;
          }
        }
      }

      const walletClient = createWalletClient({
        account: walletAddress as Address,
        chain: sepoliaChain,
        transport: custom(window.ethereum),
      });

      const allowance = (await sepoliaPublic.readContract({
        address: sepoliaUsdcAddress,
        abi: erc20MinAbi,
        functionName: "allowance",
        args: [walletAddress as Address, cctpV2.tokenMessengerAddress],
      })) as bigint;

      if (allowance < amountWei) {
        setStage("approving");
        const approveHash = await walletClient.writeContract({
          address: sepoliaUsdcAddress,
          abi: erc20MinAbi,
          functionName: "approve",
          args: [cctpV2.tokenMessengerAddress, amountWei],
        });
        await sepoliaPublic.waitForTransactionReceipt({ hash: approveHash });
      }

      setStage("burning");
      const burnHash = await walletClient.writeContract({
        address: cctpV2.tokenMessengerAddress,
        abi: tokenMessengerV2Abi,
        functionName: "depositForBurnWithHook",
        args: [
          amountWei,
          destinationDomains.arcTestnet,
          addressToBytes32(walletAddress as Address),
          sepoliaUsdcAddress,
          ZERO_BYTES32,
          cctpDefaults.maxFee,
          cctpDefaults.finalityThreshold,
          cctpV2.forwarderHook,
        ],
      });
      setBurnTxHash(burnHash);
      await sepoliaPublic.waitForTransactionReceipt({ hash: burnHash });

      setStage("polling");
      const start = Date.now();
      let finalStatus: AttestationStatus | undefined;
      let destHash: Hex | undefined;
      while (Date.now() - start < 5 * 60_000) {
        const res = await fetchAttestation(sourceDomains.ethereumSepolia, burnHash);
        const msg = res.messages?.[0];
        if (msg?.status) {
          finalStatus = msg.status;
          setAttestationStatus(msg.status);
          if (msg.txHash) {
            destHash = msg.txHash as Hex;
            setDestTxHash(msg.txHash as Hex);
          }
        }
        if (finalStatus === "complete") break;
        if (finalStatus === "expired") break;
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }

      if (finalStatus === "complete") {
        setStage("complete");
        void refreshSepoliaBalance();
      } else if (finalStatus === "expired") {
        setStage("failed");
        setError("Circle reported the attestation as expired. Try a larger amount or retry.");
      } else {
        setStage("failed");
        setError(
          "Timed out waiting for Circle's attestation. The burn on Sepolia succeeded — Circle should still mint on Arc shortly. Check your Arc balance.",
        );
      }
    } catch (err) {
      setStage("failed");
      setError(normalizeError(err));
    }
  }, [walletAddress, amount, refreshSepoliaBalance]);

  const isRunning = stage !== "idle" && stage !== "complete" && stage !== "failed";

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <SectionHeader
        title="Bridge USDC"
        subtitle="Move native USDC from Ethereum Sepolia to Arc Testnet via Circle's CCTP V2 forwarder."
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-6 shadow-card">
          <header className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Coins className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-text">Sepolia → Arc Testnet</h2>
              <p className="text-xs text-muted">
                Single signature on Sepolia. Circle&apos;s forwarder service mints the USDC on Arc
                automatically.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Amount (USDC)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isRunning}
              className="w-full rounded-xl border border-line bg-panel-muted px-4 py-3 text-lg font-semibold tabular-nums text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                Sepolia balance: {balanceLoading ? "loading…" : sepoliaBalance}
              </span>
              <button
                type="button"
                onClick={refreshSepoliaBalance}
                className="text-faint hover:text-text"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Destination
            </span>
            <div className="flex items-center justify-between rounded-xl border border-line-soft bg-panel-muted px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-text">Arc Testnet</div>
                <div className="text-xs text-muted">
                  Domain {destinationDomains.arcTestnet} · auto-mint via forwarder hook
                </div>
              </div>
              <ShieldCheck className="size-5 text-accent" strokeWidth={1.75} />
            </div>
          </div>

          {walletAddress ? (
            <button
              type="button"
              onClick={handleBridge}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
            >
              {isRunning ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <ArrowRight className="size-4" strokeWidth={2.25} />
              )}
              {stageButtonLabel(stage)}
            </button>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-strong"
            >
              Connect wallet to bridge
            </button>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
              <XCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
        <UnifiedBalance />
        <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-6 shadow-card">
          <h3 className="text-sm font-semibold text-text">Progress</h3>
          <ol className="flex flex-col gap-2">
            {STAGES.map((step, index) => {
              const status = stageStatus(stage, step.id);
              return (
                <li key={step.id} className="flex items-center gap-3">
                  <span
                    className={[
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      status === "done"
                        ? "bg-success-soft text-success"
                        : status === "active"
                          ? "bg-accent-soft text-accent"
                          : "bg-panel-muted text-faint",
                    ].join(" ")}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="size-4" strokeWidth={2.25} />
                    ) : status === "active" ? (
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={[
                      "text-sm",
                      status === "pending" ? "text-faint" : "text-text",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {(burnTxHash || destTxHash || attestationStatus) && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-line-soft pt-3 text-[11px]">
              {burnTxHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${burnTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted hover:text-text"
                >
                  Burn tx <code className="font-mono">{shortHashLocal(burnTxHash)}</code>
                  <ExternalLink className="size-3" strokeWidth={1.75} />
                </a>
              )}
              {attestationStatus && (
                <span className="text-muted">
                  Iris status: <code className="font-mono">{attestationStatus}</code>
                </span>
              )}
              {destTxHash && (
                <a
                  href={`https://testnet.arcscan.app/tx/${destTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted hover:text-text"
                >
                  Arc tx <code className="font-mono">{shortHashLocal(destTxHash)}</code>
                  <ExternalLink className="size-3" strokeWidth={1.75} />
                </a>
              )}
            </div>
          )}
        </aside>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-line-soft bg-panel-muted/30 p-4 text-xs text-muted">
        <p>
          <span className="font-semibold text-text">How this works:</span> we call
          <code className="mx-1 font-mono">depositForBurnWithHook</code> on Circle&apos;s
          TokenMessengerV2 at <code className="font-mono">0x8FE6…2DAA</code>, attach the
          <code className="mx-1 font-mono">cctp-forward</code> hook payload, and let Circle&apos;s
          forwarder service relay the attestation to MessageTransmitterV2 on Arc Testnet (domain
          26). One signature, one tx — the destination mint is gas-paid by Circle.
        </p>
      </section>
    </div>
  );
}

function stageButtonLabel(stage: BridgeStage): string {
  switch (stage) {
    case "switching":
      return "Switching to Sepolia…";
    case "approving":
      return "Approving USDC…";
    case "burning":
      return "Burning on Sepolia…";
    case "polling":
      return "Awaiting Circle attestation…";
    case "complete":
      return "Bridge complete · go again";
    case "failed":
      return "Retry bridge";
    default:
      return "Bridge USDC";
  }
}

function stageStatus(current: BridgeStage, step: BridgeStage): "done" | "active" | "pending" {
  const order: BridgeStage[] = [
    "switching",
    "approving",
    "burning",
    "polling",
    "complete",
  ];
  if (current === "failed") {
    return order.indexOf(step) < order.indexOf("polling") ? "pending" : "pending";
  }
  const ci = order.indexOf(current);
  const si = order.indexOf(step);
  if (ci === -1) return "pending";
  if (si < ci) return "done";
  if (si === ci) return current === "complete" && step === "complete" ? "done" : "active";
  return "pending";
}
