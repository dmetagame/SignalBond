import { NextResponse } from "next/server";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  HTTPFacilitatorClient,
} from "@x402/core/http";
import { arcCanteen, signalBondAddress, usdcAddress } from "../../../lib/contract";

const PRICE_ATOMIC_USDC = "1000"; // 0.001 USDC
const NETWORK = `eip155:${arcCanteen.id}` as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
  const paymentRequired = buildPaymentRequired(request.url);

  if (!paymentSignature) {
    return NextResponse.json(
      {
        error: "x402 payment required",
        mode: "arc-oss-demo",
        note:
          "SignalBond emits a real x402 Payment Required challenge. Settlement is marked demo until an Arc-compatible facilitator is available.",
      },
      {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let payload: PaymentPayload | undefined;
  try {
    payload = decodePaymentSignatureHeader(paymentSignature);
  } catch {
    return NextResponse.json(
      { error: "Invalid PAYMENT-SIGNATURE header." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const selectedRequirement = paymentRequired.accepts[0];
  if (!selectedRequirement) {
    return NextResponse.json(
      { error: "No x402 payment requirement is configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!facilitatorConfigured()) {
    return NextResponse.json(
      {
        resource: "SignalBond paid signal pack",
        mode: "facilitator-pending",
        signedBy: readPayer(payload),
        accepted: payload.accepted,
        paidContent: "locked",
        note:
          "Payment payload decoded locally. Configure X402_FACILITATOR_URL before releasing paid signal content.",
      },
      {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
          "X-SignalBond-X402-Mode": "facilitator-pending",
        },
      },
    );
  }

  let settlement;
  try {
    settlement = await settleWithFacilitator(payload, selectedRequirement);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "x402 facilitator settlement failed.",
        mode: "facilitator-settlement-failed",
      },
      {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!settlement.success) {
    return NextResponse.json(
      {
        error: settlement.errorMessage ?? "x402 facilitator rejected payment.",
        reason: settlement.errorReason,
        mode: "facilitator-settlement-rejected",
      },
      {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      resource: "SignalBond paid signal pack",
      mode: "facilitator-verified",
      paidBy: readPayer(payload),
      accepted: payload.accepted,
      signals: [
        {
          market: "USDC/EURC",
          thesis: "Paid agents receive the higher-resolution source bundle before public release.",
          escrowPrimitive: "createSignal -> stake escrow -> resolveSignal",
        },
        {
          market: "BTC",
          thesis: "Session-scoped agents can request paid context before publishing a staked call.",
          escrowPrimitive: "x402 API payment -> SignalBond stake -> onchain reputation",
        },
      ],
    },
    {
      headers: {
        "PAYMENT-RESPONSE": encodePaymentResponseHeader(settlement),
        "Cache-Control": "no-store",
      },
    },
  );
}

function readPayer(payload: PaymentPayload): unknown {
  const authorization = payload.payload.authorization;
  if (
    typeof authorization === "object" &&
    authorization !== null &&
    "from" in authorization
  ) {
    return authorization.from;
  }

  const permit2Authorization = payload.payload.permit2Authorization;
  if (
    typeof permit2Authorization === "object" &&
    permit2Authorization !== null &&
    "from" in permit2Authorization
  ) {
    return permit2Authorization.from;
  }

  return undefined;
}

function buildPaymentRequired(url: string): PaymentRequired {
  const payTo = signalBondAddress ?? usdcAddress;

  return {
    x402Version: 2,
    error: "SignalBond paid signal pack requires an x402 payment authorization.",
    resource: {
      url,
      serviceName: "SignalBond",
      description: "Paid agent signal pack gated by x402.",
      mimeType: "application/json",
      tags: ["arc", "x402", "agents", "signals", "usdc"],
    },
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        asset: usdcAddress,
        amount: PRICE_ATOMIC_USDC,
        payTo,
        maxTimeoutSeconds: 60,
        extra: {
          name: "USDC",
          version: "2",
          decimals: 6,
          assetTransferMethod: "eip3009",
        },
      },
    ],
  };
}

function facilitatorConfigured(): boolean {
  return Boolean(process.env.X402_FACILITATOR_URL?.trim());
}

async function settleWithFacilitator(
  paymentPayload: PaymentPayload,
  paymentRequirement: PaymentRequired["accepts"][number],
) {
  const url = process.env.X402_FACILITATOR_URL?.trim();
  if (!url) {
    throw new Error("X402_FACILITATOR_URL is not configured.");
  }

  const apiKey = process.env.X402_FACILITATOR_API_KEY?.trim();
  const authHeaders: Record<string, string> = apiKey
    ? { authorization: `Bearer ${apiKey}` }
    : {};
  const facilitator = new HTTPFacilitatorClient({
    url,
    createAuthHeaders: async () => ({
      verify: authHeaders,
      settle: authHeaders,
      supported: authHeaders,
    }),
  });

  return facilitator.settle(paymentPayload, paymentRequirement);
}
