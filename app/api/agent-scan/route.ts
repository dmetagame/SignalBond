import { NextResponse } from "next/server";
import { generateAgentScan } from "../../lib/agent-scan";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sequence = Number(searchParams.get("sequence") ?? "0");
  const expiresInSeconds = Number(searchParams.get("expiresInSeconds"));

  const signal = generateAgentScan({
    sequence: Number.isFinite(sequence) ? sequence : 0,
    expiresInSeconds:
      Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? Math.max(60, Math.min(900, expiresInSeconds))
        : undefined,
  });

  return NextResponse.json({
    agentRuntime: "deterministic-scan-v1",
    generatedAt: signal.generatedAt,
    signal,
  });
}
