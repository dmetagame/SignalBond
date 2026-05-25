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
type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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
  const rateLimit = evaluateRateLimit(request);
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: "Agent scan rate limit exceeded.",
        retryAt: new Date(rateLimit.resetAt).toISOString(),
      },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const sequence = Number(searchParams.get("sequence") ?? "0");
  const expiresInSecondsRaw = Number(searchParams.get("expiresInSeconds"));
  const expiresInSeconds =
    Number.isFinite(expiresInSecondsRaw) && expiresInSecondsRaw > 0
      ? Math.max(60, Math.min(900, expiresInSecondsRaw))
      : undefined;
  const seq = Number.isFinite(sequence) ? sequence : 0;

  const providerHint = searchParams.get("provider");
  const provider = pickProvider(providerHint);

  if (provider === "groq") {
    try {
      const signal = await generateAgentScanWithGroq({
        sequence: seq,
        expiresInSeconds,
      });
      return proposalResponse(
        {
          agentRuntime: `groq:${groqRuntimeLabel()}`,
          generatedAt: signal.generatedAt,
          provider: "groq",
          providerStatus: providerStatus("groq", rateLimit),
          signal,
        },
        rateLimit,
      );
    } catch (error) {
      const message = fallbackReason(error, "groq");
      if (llmConfigured()) {
        try {
          const signal = await generateAgentScanWithLlm({
            sequence: seq,
            expiresInSeconds,
          });
          return proposalResponse(
            {
              agentRuntime: "claude-haiku-4-5",
              fallback: true,
              fallbackReason: message,
              generatedAt: signal.generatedAt,
              provider: "anthropic",
              providerStatus: providerStatus("anthropic", rateLimit),
              signal,
            },
            rateLimit,
          );
        } catch {
          // fall through to deterministic
        }
      }
      const signal = generateAgentScan({ sequence: seq, expiresInSeconds });
      return proposalResponse(
        {
          agentRuntime: "deterministic-scan-v1",
          fallback: true,
          fallbackReason: message,
          generatedAt: signal.generatedAt,
          provider: "seed",
          providerStatus: providerStatus("seed", rateLimit),
          signal,
        },
        rateLimit,
      );
    }
  }

  if (provider === "anthropic") {
    try {
      const signal = await generateAgentScanWithLlm({
        sequence: seq,
        expiresInSeconds,
      });
      return proposalResponse(
        {
          agentRuntime: "claude-haiku-4-5",
          generatedAt: signal.generatedAt,
          provider: "anthropic",
          providerStatus: providerStatus("anthropic", rateLimit),
          signal,
        },
        rateLimit,
      );
    } catch (error) {
      const message = fallbackReason(error, "anthropic");
      const signal = generateAgentScan({ sequence: seq, expiresInSeconds });
      return proposalResponse(
        {
          agentRuntime: "deterministic-scan-v1",
          fallback: true,
          fallbackReason: message,
          generatedAt: signal.generatedAt,
          provider: "seed",
          providerStatus: providerStatus("seed", rateLimit),
          signal,
        },
        rateLimit,
      );
    }
  }

  const signal = generateAgentScan({ sequence: seq, expiresInSeconds });
  const seedRequested = providerHint === "seed";
  return proposalResponse(
    {
      agentRuntime: "deterministic-scan-v1",
      fallback: !seedRequested,
      fallbackReason: seedRequested ? undefined : "no-llm-provider-configured",
      generatedAt: signal.generatedAt,
      provider: "seed",
      providerStatus: providerStatus("seed", rateLimit),
      signal,
    },
    rateLimit,
  );
}

function fallbackReason(error: unknown, provider: "groq" | "anthropic"): string {
  const summary = error instanceof Error ? error.message : String(error);
  console.warn(`SignalBond ${provider} proposal failed; serving deterministic fallback.`, {
    error: summary,
  });
  return `${provider}-proposal-runtime-unavailable`;
}

function proposalResponse(
  payload: {
    agentRuntime: string;
    fallback?: boolean;
    fallbackReason?: string;
    generatedAt: string;
    provider: Provider;
    providerStatus: ReturnType<typeof providerStatus>;
    signal: ReturnType<typeof generateAgentScan>;
  },
  rateLimit: RateLimitResult,
) {
  return NextResponse.json(
    {
      ...payload,
      signal: {
        ...payload.signal,
        agentRuntime: payload.agentRuntime,
        fallback: payload.fallback,
        fallbackReason: payload.fallbackReason,
        provider: payload.provider,
        providerStatus: payload.providerStatus,
      },
    },
    { headers: rateLimitHeaders(rateLimit) },
  );
}

function providerStatus(selectedProvider: Provider, rateLimit: RateLimitResult) {
  return {
    groqConfigured: groqConfigured(),
    anthropicConfigured: llmConfigured(),
    selectedProvider,
    rateLimit: {
      remaining: rateLimit.remaining,
      resetAt: new Date(rateLimit.resetAt).toISOString(),
    },
  };
}

function evaluateRateLimit(request: Request): RateLimitResult {
  const now = Date.now();
  const key = clientKey(request);
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitBuckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  current.count += 1;
  return {
    ok: current.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - current.count),
    resetAt: current.resetAt,
  };
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function rateLimitHeaders(rateLimit: RateLimitResult): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };
}
