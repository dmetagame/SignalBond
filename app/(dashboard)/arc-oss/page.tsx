"use client";

import {
  ArrowRight,
  BadgeCheck,
  Code2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  Radio,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from "@x402/core/http";
import type { PaymentRequired, SettleResponse } from "@x402/core/types";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";
import {
  createWalletClient,
  custom,
  parseUnits,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useDashboard } from "../../components/dashboard/DashboardProvider";
import SectionHeader from "../../components/dashboard/SectionHeader";
import {
  arcCanteen,
  signalBondAddress,
  usdcAddress,
} from "../../lib/contract";
import { normalizeError, shortHash } from "../../lib/dashboard-actions";
import { formatUsdc } from "../../lib/reputation";
import { signalBondWagmiConfig } from "../../lib/wagmi";

const X402_SIGNAL_PACK_URL = "/api/x402/signal-pack";
const SESSION_SCOPE = "createSignal, resolveSignal";
const MAX_SESSION_STAKE_USDC = "5";

type X402State = {
  status: "idle" | "checking" | "challenge" | "paying" | "signed" | "paid" | "failed";
  requirement?: PaymentRequired;
  settlement?: SettleResponse;
  response?: unknown;
  error?: string;
};

type SessionGrant = {
  sessionKey: Address;
  owner: Address;
  target: Address;
  scope: string;
  maxStakeUsdc: string;
  validUntil: number;
  signature: Hex;
  verified: boolean;
};

const sessionGrantTypes = {
  SessionGrant: [
    { name: "owner", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "target", type: "address" },
    { name: "scope", type: "string" },
    { name: "maxStakeUsdc", type: "uint256" },
    { name: "validUntil", type: "uint64" },
  ],
} as const;

export default function ArcOssPage() {
  const { walletAddress, walletOnArc, connectWallet } = useDashboard();
  const [x402State, setX402State] = useState<X402State>({ status: "idle" });
  const [sessionGrant, setSessionGrant] = useState<SessionGrant>();
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string>();
  const wagmiChain = signalBondWagmiConfig.chains[0];

  async function inspectX402Challenge() {
    setX402State({ status: "checking" });
    try {
      const response = await fetch(X402_SIGNAL_PACK_URL, { cache: "no-store" });
      const header = response.headers.get("PAYMENT-REQUIRED");
      if (response.status !== 402 || !header) {
        throw new Error(`Expected 402 challenge, received ${response.status}.`);
      }
      setX402State({
        status: "challenge",
        requirement: decodePaymentRequiredHeader(header),
      });
    } catch (error) {
      setX402State({ status: "failed", error: normalizeError(error) });
    }
  }

  async function payWithX402Client() {
    setX402State((current) => ({ ...current, status: "paying", error: undefined }));
    try {
      if (!walletAddress) {
        await connectWallet();
        throw new Error("Wallet connected. Click Pay with x402 again to sign the payment payload.");
      }
      if (!window.ethereum) {
        throw new Error("No injected wallet found.");
      }

      const walletClient = createWalletClient({
        account: walletAddress,
        chain: arcCanteen,
        transport: custom(window.ethereum),
      });
      const signer: ClientEvmSigner = {
        address: walletAddress,
        signTypedData: (payload) =>
          walletClient.signTypedData({
            account: walletAddress,
            domain: payload.domain,
            types: payload.types,
            primaryType: payload.primaryType,
            message: payload.message,
          }),
      };
      const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
        schemes: [
          {
            network: `eip155:${arcCanteen.id}`,
            client: new ExactEvmScheme(signer),
          },
        ],
      });
      const response = await fetchWithPayment(X402_SIGNAL_PACK_URL, {
        method: "GET",
        cache: "no-store",
      });
      const settlementHeader = response.headers.get("PAYMENT-RESPONSE");
      const settlement = settlementHeader
        ? decodePaymentResponseHeader(settlementHeader)
        : undefined;
      const body = await response.json();
      const facilitatorPending =
        response.status === 202 ||
        response.headers.get("X-SignalBond-X402-Mode") === "facilitator-pending";
      setX402State({
        status: response.ok ? (facilitatorPending ? "signed" : "paid") : "failed",
        settlement,
        response: body,
        error: response.ok ? undefined : `x402 request failed with ${response.status}.`,
      });
    } catch (error) {
      setX402State((current) => ({
        ...current,
        status: "failed",
        error: normalizeError(error),
      }));
    }
  }

  async function signSessionGrant() {
    setSessionBusy(true);
    setSessionError(undefined);
    try {
      if (!walletAddress) {
        await connectWallet();
        throw new Error("Wallet connected. Click Authorize session again to sign the scope.");
      }
      if (!window.ethereum) {
        throw new Error("No injected wallet found.");
      }
      if (!signalBondAddress) {
        throw new Error("SignalBond contract is not configured.");
      }

      const sessionAccount = privateKeyToAccount(generatePrivateKey());
      const validUntil = Math.floor(Date.now() / 1000) + 30 * 60;
      const walletClient = createWalletClient({
        account: walletAddress,
        chain: arcCanteen,
        transport: custom(window.ethereum),
      });
      const domain = {
        name: "SignalBond Session Grant",
        version: "1",
        chainId: arcCanteen.id,
        verifyingContract: signalBondAddress,
      } as const;
      const message = {
        owner: walletAddress,
        sessionKey: sessionAccount.address,
        target: signalBondAddress,
        scope: SESSION_SCOPE,
        maxStakeUsdc: parseUnits(MAX_SESSION_STAKE_USDC, 6),
        validUntil: BigInt(validUntil),
      } as const;
      const signature = await walletClient.signTypedData({
        account: walletAddress,
        domain,
        types: sessionGrantTypes,
        primaryType: "SessionGrant",
        message,
      });
      const verified = await verifyTypedData({
        address: walletAddress,
        domain,
        types: sessionGrantTypes,
        primaryType: "SessionGrant",
        message,
        signature,
      });

      setSessionGrant({
        owner: walletAddress,
        sessionKey: sessionAccount.address,
        target: signalBondAddress,
        scope: SESSION_SCOPE,
        maxStakeUsdc: MAX_SESSION_STAKE_USDC,
        validUntil,
        signature,
        verified,
      });
    } catch (error) {
      setSessionError(normalizeError(error));
    } finally {
      setSessionBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-6">
      <SectionHeader
        title="Arc OSS"
        subtitle="Reusable frontend primitives for paid agent context, scoped signing, escrow, and reputation."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatusCard
          icon={<Wallet className="size-4" strokeWidth={1.75} />}
          label="Wallet"
          value={walletAddress ? shortHash(walletAddress) : "Not connected"}
          active={Boolean(walletAddress)}
        />
        <StatusCard
          icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
          label="Network"
          value={walletOnArc ? "Arc Testnet" : "Needs Arc"}
          active={walletOnArc}
        />
        <StatusCard
          icon={<ReceiptText className="size-4" strokeWidth={1.75} />}
          label="wagmi chain"
          value={`${wagmiChain.name} ${wagmiChain.id}`}
          active
        />
        <StatusCard
          icon={<KeyRound className="size-4" strokeWidth={1.75} />}
          label="Session scope"
          value={SESSION_SCOPE}
          active={Boolean(sessionGrant)}
        />
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          icon={<ReceiptText className="size-4" strokeWidth={1.75} />}
          title="x402 Paid Signal Pack"
          description="Client-side fetch wrapper handles a real 402 challenge, signs an EVM payment payload, and retries the request."
        >
          <div className="rounded-xl border border-line-soft bg-panel-muted p-3 text-xs leading-relaxed text-muted">
            Arc Testnet is wired through a reusable wagmi config and viem signer at{" "}
            <span className="font-mono text-text">eip155:{arcCanteen.id}</span>. The endpoint uses
            x402 headers today; paid content unlocks only when an Arc-compatible facilitator verifies settlement.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={inspectX402Challenge}
              disabled={x402State.status === "checking" || x402State.status === "paying"}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted hover:text-text disabled:opacity-60"
            >
              {x402State.status === "checking" ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Radio className="size-4" strokeWidth={1.75} />
              )}
              Inspect 402
            </button>
            <button
              type="button"
              onClick={payWithX402Client}
              disabled={x402State.status === "checking" || x402State.status === "paying"}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
            >
              {x402State.status === "paying" ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <ReceiptText className="size-4" strokeWidth={1.75} />
              )}
              Sign x402 payload
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {x402State.requirement && <PaymentRequiredView requirement={x402State.requirement} />}
            {x402State.settlement && <SettlementView settlement={x402State.settlement} />}
            {x402State.status === "signed" && <FacilitatorPendingView response={x402State.response} />}
            {x402State.error && <ErrorText message={x402State.error} />}
          </div>
        </Panel>

        <Panel
          icon={<KeyRound className="size-4" strokeWidth={1.75} />}
          title="Session Grant Prototype"
          description="Generate an ephemeral signer, sign a scoped EIP-712 grant, and verify the owner signature locally."
        >
          <div className="rounded-xl border border-line-soft bg-panel-muted p-3 text-xs leading-relaxed text-muted">
            The session private key is generated in memory only. This proves the grant signature;
            execution still needs a smart-account or contract validation adapter.
          </div>

          <button
            type="button"
            onClick={signSessionGrant}
            disabled={sessionBusy}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
          >
            {sessionBusy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <LockKeyhole className="size-4" strokeWidth={1.75} />
            )}
            Sign grant
          </button>

          <div className="mt-4">
            {sessionGrant ? (
              <SessionGrantView grant={sessionGrant} />
            ) : (
              <EmptyState text="No session grant signed yet." />
            )}
            {sessionError && <ErrorText message={sessionError} />}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PrimitiveCard
          title="Escrow Primitive"
          body="SignalBond already exposes USDC escrow, expiry, settlement, slashing, and stake return for agent actions."
        />
        <PrimitiveCard
          title="Paid Context Primitive"
          body="The x402 route gates premium signal context before the agent publishes a staked call."
        />
        <PrimitiveCard
          title="Scoped Agent Primitive"
          body="The session grant defines which contract, methods, stake ceiling, and time window an agent may use."
        />
      </section>

      <Panel
        icon={<Code2 className="size-4" strokeWidth={1.75} />}
        title="Reusable Frontend Flow"
        description="This is the shape other Arc builders can lift for prediction markets, identity, escrow, or yield-routing products."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {["402 challenge", "x402 signed payload", "verified grant", "SignalBond escrow"].map(
            (step, index) => (
              <div key={step} className="rounded-xl border border-line-soft bg-panel-muted p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-faint">{index + 1}</span>
                  {index < 3 && <ArrowRight className="size-4 text-faint" strokeWidth={1.75} />}
                </div>
                <div className="mt-4 text-sm font-semibold text-text">{step}</div>
              </div>
            ),
          )}
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-card">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-muted text-muted">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function StatusCard({
  icon,
  label,
  value,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-panel-muted text-muted">
          {icon}
        </span>
        <span
          className={[
            "size-2 rounded-full",
            active ? "bg-success" : "bg-panel-muted",
          ].join(" ")}
        />
      </div>
      <div className="mt-4 text-[11px] font-medium uppercase tracking-wider text-faint">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

function PaymentRequiredView({ requirement }: { requirement: PaymentRequired }) {
  const selected = requirement.accepts[0];
  return (
    <div className="rounded-xl border border-line-soft bg-panel-muted p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text">
        <BadgeCheck className="size-4 text-accent" strokeWidth={1.75} />
        Payment challenge received
      </div>
      <ValueRow label="Network" value={selected?.network ?? "—"} />
      <ValueRow label="Asset" value={selected?.asset ? shortHash(selected.asset) : "—"} />
      <ValueRow
        label="Amount"
        value={selected ? formatUsdc(Number(selected.amount) / 1_000_000) : "—"}
      />
      <ValueRow label="Scheme" value={selected?.scheme ?? "—"} />
    </div>
  );
}

function SettlementView({ settlement }: { settlement: SettleResponse }) {
  return (
    <div className="rounded-xl border border-success/30 bg-success-soft p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-success">
        <BadgeCheck className="size-4" strokeWidth={1.75} />
        x402 facilitator settlement verified
      </div>
      <ValueRow label="Mode" value="Facilitator verified" />
      <ValueRow label="Network" value={settlement.network} />
      <ValueRow label="Amount" value={settlement.amount ?? "—"} />
      <ValueRow label="Receipt" value={shortHash(settlement.transaction)} />
    </div>
  );
}

function FacilitatorPendingView({ response }: { response: unknown }) {
  const mode =
    typeof response === "object" && response !== null && "mode" in response
      ? String((response as { mode?: unknown }).mode)
      : "facilitator-pending";
  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text">
        <BadgeCheck className="size-4 text-accent" strokeWidth={1.75} />
        x402 payload signed
      </div>
      <ValueRow label="Mode" value={mode} />
      <ValueRow label="Paid content" value="Locked until facilitator verifies settlement" />
    </div>
  );
}

function SessionGrantView({ grant }: { grant: SessionGrant }) {
  return (
    <div className="rounded-xl border border-line-soft bg-panel-muted p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-text">
        <KeyRound className="size-4 text-accent" strokeWidth={1.75} />
        Scoped grant signed
      </div>
      <ValueRow label="Owner" value={shortHash(grant.owner)} copyValue={grant.owner} />
      <ValueRow label="Session key" value={shortHash(grant.sessionKey)} copyValue={grant.sessionKey} />
      <ValueRow label="Target" value={shortHash(grant.target)} copyValue={grant.target} />
      <ValueRow label="Scope" value={grant.scope} />
      <ValueRow label="Max stake" value={`${grant.maxStakeUsdc} USDC`} />
      <ValueRow label="Expires" value={new Date(grant.validUntil * 1000).toLocaleTimeString()} />
      <ValueRow
        label="Local verifier"
        value={grant.verified ? "Owner signature valid" : "Signature check failed"}
      />
      <ValueRow label="Signature" value={shortHash(grant.signature)} copyValue={grant.signature} />
    </div>
  );
}

function PrimitiveCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
      <div className="text-sm font-semibold text-text">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function ValueRow({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-2 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-right font-mono text-xs font-semibold text-text">
        <span className="truncate">{value}</span>
        {copyValue && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(copyValue)}
            aria-label={`Copy ${label}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-faint hover:bg-panel hover:text-text"
          >
            <Copy className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-soft bg-panel-muted/50 px-3 py-8 text-center text-sm text-faint">
      {text}
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}
