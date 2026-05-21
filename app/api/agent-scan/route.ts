import { NextResponse } from "next/server";
import { generateAgentScan } from "../../lib/agent-scan";
import { generateAgentScanWithLlm, llmConfigured } from "../../lib/agent-scan-llm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sequence = Number(searchParams.get("sequence") ?? "0");
  const expiresInSecondsRaw = Number(searchParams.get("expiresInSeconds"));
  const expiresInSeconds =
    Number.isFinite(expiresInSecondsRaw) && expiresInSecondsRaw > 0
      ? Math.max(60, Math.min(900, expiresInSecondsRaw))
      : undefined;
  const providerHint = searchParams.get("provider");
  const useLlm = providerHint === "seed" ? false : llmConfigured();

  if (useLlm) {
    try {
      const signal = await generateAgentScanWithLlm({
        sequence: Number.isFinite(sequence) ? sequence : 0,
        expiresInSeconds,
      });
      return NextResponse.json({
        agentRuntime: "claude-haiku-4-5",
        generatedAt: signal.generatedAt,
        signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "LLM scan failed";
      const signal = generateAgentScan({
        sequence: Number.isFinite(sequence) ? sequence : 0,
        expiresInSeconds,
      });
      return NextResponse.json({
        agentRuntime: "deterministic-scan-v1",
        fallback: true,
        fallbackReason: message,
        generatedAt: signal.generatedAt,
        signal,
      });
    }
  }

  const signal = generateAgentScan({
    sequence: Number.isFinite(sequence) ? sequence : 0,
    expiresInSeconds,
  });

  return NextResponse.json({
    agentRuntime: "deterministic-scan-v1",
    generatedAt: signal.generatedAt,
    signal,
  });
}
