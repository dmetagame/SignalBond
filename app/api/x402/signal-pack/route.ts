import { NextResponse } from "next/server";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import { arcCanteen, signalBondAddress, usdcAddress } from "../../../lib/contract";

const PRICE_ATOMIC_USDC = "1000"; // 0.001 USDC
const NETWORK = `eip155:${arcCanteen.id}` as const;
const DEMO_SETTLEMENT_TX =
  "0x0000000000000000000000000000000000000000000000000000000000000402";

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

  return NextResponse.json(
    {
      resource: "SignalBond paid signal pack",
      mode: "x402-client-demo",
      settlement: "facilitator-pending",
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
        "PAYMENT-RESPONSE": encodePaymentResponseHeader({
          success: true,
          transaction: DEMO_SETTLEMENT_TX,
          network: NETWORK,
          amount: PRICE_ATOMIC_USDC,
          extra: {
            mode: "demo-no-facilitator",
            reason: "Arc Testnet facilitator support is the remaining production dependency.",
          },
        }),
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
