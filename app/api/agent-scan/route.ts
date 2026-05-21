import { NextResponse } from "next/server";
import { generateAgentScan } from "../../lib/agent-scan";
import {
  generateAgentScanWithGroq,
  groqConfigured,
  groqRuntimeLabel,
} from "../../lib/agent-scan-groq";
import { generateAgentScanWithLlm, llmConfigured } from "../../lib/agent-scan-llm";

export const dynamic = "force-dynamic";

type Provider = "groq" | "anthropic" | "seed";

function pickProvider(hint: string | null): Provider {
  if (hint === "seed") return "seed";
  if (hint === "anthropic" || hint === "claude") {
    return llmConfigured() ? "anthropic" : groqConfigured() ? "groq" : "seed";
  }
  if (hint === "groq" || hint === "llama") {
    return groqConfigured() ? "groq" : llmConfigured() ? "anthropic" : "seed";
  }
  if (groqConfigured()) return "groq";
  if (llmConfigured()) return "anthropic";
  return "seed";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sequence = Number(searchParams.get("sequence") ?? "0");
  const expiresInSecondsRaw = Number(searchParams.get("expiresInSeconds"));
  const expiresInSeconds =
    Number.isFinite(expiresInSecondsRaw) && expiresInSecondsRaw > 0
      ? Math.max(60, Math.min(900, expiresInSecondsRaw))
      : undefined;
  const seq = Number.isFinite(sequence) ? sequence : 0;

  const provider = pickProvider(searchParams.get("provider"));

  if (provider === "groq") {
    try {
      const signal = await generateAgentScanWithGroq({
        sequence: seq,
        expiresInSeconds,
      });
      return NextResponse.json({
        agentRuntime: `groq:${groqRuntimeLabel()}`,
        generatedAt: signal.generatedAt,
        signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Groq scan failed";
      if (llmConfigured()) {
        try {
          const signal = await generateAgentScanWithLlm({
            sequence: seq,
            expiresInSeconds,
          });
          return NextResponse.json({
            agentRuntime: "claude-haiku-4-5",
            fallback: true,
            fallbackReason: message,
            generatedAt: signal.generatedAt,
            signal,
          });
        } catch {
          // fall through to deterministic
        }
      }
      const signal = generateAgentScan({ sequence: seq, expiresInSeconds });
      return NextResponse.json({
        agentRuntime: "deterministic-scan-v1",
        fallback: true,
        fallbackReason: message,
        generatedAt: signal.generatedAt,
        signal,
      });
    }
  }

  if (provider === "anthropic") {
    try {
      const signal = await generateAgentScanWithLlm({
        sequence: seq,
        expiresInSeconds,
      });
      return NextResponse.json({
        agentRuntime: "claude-haiku-4-5",
        generatedAt: signal.generatedAt,
        signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Anthropic scan failed";
      const signal = generateAgentScan({ sequence: seq, expiresInSeconds });
      return NextResponse.json({
        agentRuntime: "deterministic-scan-v1",
        fallback: true,
        fallbackReason: message,
        generatedAt: signal.generatedAt,
        signal,
      });
    }
  }

  const signal = generateAgentScan({ sequence: seq, expiresInSeconds });
  return NextResponse.json({
    agentRuntime: "deterministic-scan-v1",
    generatedAt: signal.generatedAt,
    signal,
  });
}
