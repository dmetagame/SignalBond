import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { contractsConfigured } from "../../lib/contract";
import { serializeDashboard } from "../../lib/chain-state";
import { readOnchainDashboard } from "../../lib/onchain";
import { agents } from "../../lib/seed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  if (!contractsConfigured) {
    return NextResponse.json(
      {
        error: "Contracts are not configured.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const accountParam = searchParams.get("account");
  const account =
    accountParam && isAddress(accountParam) ? (accountParam as Address) : undefined;

  try {
    const dashboard = await readOnchainDashboard(agents, account);
    return NextResponse.json(serializeDashboard(dashboard), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to read chain state.",
      },
      { status: 500 },
    );
  }
}
