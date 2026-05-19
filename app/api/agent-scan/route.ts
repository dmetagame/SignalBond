import { NextResponse } from "next/server";
import { generateAgentScan } from "../../lib/agent-scan";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sequence = Number(searchParams.get("sequence") ?? "0");

  const signal = generateAgentScan({
    sequence: Number.isFinite(sequence) ? sequence : 0,
  });

  return NextResponse.json({
    agentRuntime: "deterministic-scan-v1",
    generatedAt: signal.generatedAt,
    signal,
  });
}
