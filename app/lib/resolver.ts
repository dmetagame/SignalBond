import type { Direction, Signal } from "./types";

/**
 * Pure resolution logic — given a Signal and a fetched market quote at expiry,
 * produce a verdict (correct/pnlBps) that matches what the onchain
 * `resolveSignal` call will record. Kept side-effect-free so the same function
 * runs in tests, the API route, and the resolver UI.
 */

export type MarketQuote = {
  symbol: string;
  price: number;
  source: string;
  fetchedAt: string;
  observedAt: string;
  proofUrl: string;
  method: "historical-range" | "spot";
};

export type ResolutionVerdict = {
  correct: boolean;
  pnlBps: number;
  exitPrice: number;
  reasoning: string;
};

/**
 * Map a SignalBond market label to a CoinGecko id. Falls back to undefined when
 * the market isn't a tradeable spot pair (CPI prints, election odds, vol spread)
 * — those signals get routed to the deterministic fallback so the demo still
 * closes the loop end-to-end.
 */
const COINGECKO_BY_BASE: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDC: "usd-coin",
  EURC: "euro-coin",
  WBTC: "wrapped-bitcoin",
};

export function marketToCoingeckoId(market: string): string | undefined {
  const upper = market.toUpperCase();
  for (const base of Object.keys(COINGECKO_BY_BASE)) {
    if (upper.startsWith(`${base}-`) || upper.startsWith(`${base} `) || upper === base) {
      return COINGECKO_BY_BASE[base];
    }
  }
  // "BTC / ETH relative" and similar slashed pairs: use the first token.
  const head = upper.split(/[\s/]/)[0];
  return head ? COINGECKO_BY_BASE[head] : undefined;
}

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const HISTORICAL_WINDOW_MS = 45 * 60_000;

export async function fetchMarketQuote(
  market: string,
  observedAt = new Date(),
): Promise<MarketQuote | undefined> {
  const id = marketToCoingeckoId(market);
  if (!id) return undefined;

  const historical = await fetchHistoricalQuote(id, observedAt);
  if (historical) return historical;

  return fetchSpotQuote(id);
}

async function fetchHistoricalQuote(
  id: string,
  observedAt: Date,
): Promise<MarketQuote | undefined> {
  const observedMs = observedAt.getTime();
  if (!Number.isFinite(observedMs)) return undefined;

  const from = Math.floor((observedMs - HISTORICAL_WINDOW_MS) / 1000);
  const to = Math.floor((observedMs + HISTORICAL_WINDOW_MS) / 1000);
  const url = `${COINGECKO_API_BASE}/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { prices?: [number, number][] };
    const point = pickClosestPricePoint(json.prices ?? [], observedMs);
    if (!point) return undefined;
    const [timestampMs, price] = point;
    return {
      symbol: id,
      price,
      source: "coingecko:historical",
      fetchedAt: new Date().toISOString(),
      observedAt: new Date(timestampMs).toISOString(),
      proofUrl: url,
      method: "historical-range",
    };
  } catch {
    return undefined;
  }
}

async function fetchSpotQuote(id: string): Promise<MarketQuote | undefined> {
  const url = `${COINGECKO_API_BASE}/simple/price?ids=${id}&vs_currencies=usd`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as Record<string, { usd?: number }>;
    const price = json[id]?.usd;
    if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
    const fetchedAt = new Date().toISOString();
    return {
      symbol: id,
      price,
      source: "coingecko:spot-fallback",
      fetchedAt,
      observedAt: fetchedAt,
      proofUrl: url,
      method: "spot",
    };
  } catch {
    return undefined;
  }
}

function pickClosestPricePoint(
  prices: [number, number][],
  targetMs: number,
): [number, number] | undefined {
  let closest: [number, number] | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const point of prices) {
    const [timestampMs, price] = point;
    if (!Number.isFinite(timestampMs) || !Number.isFinite(price)) continue;
    const distance = Math.abs(timestampMs - targetMs);
    if (distance < closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  }
  return closest;
}

/**
 * Decide whether a signal's call was correct based on the price at expiry.
 *  - LONG / YES: correct when price moved up relative to entry
 *  - SHORT / NO: correct when price moved down relative to entry
 *
 * pnlBps is signed by the direction so a 2% move in the called direction always
 * shows +200, a 2% move against the call shows -200, regardless of side.
 */
export function judgeOutcome(
  signal: Signal,
  exitPrice: number,
  quote?: MarketQuote,
): ResolutionVerdict {
  const entry = signal.entryPrice;
  const moveBps = entry === 0 ? 0 : Math.round(((exitPrice - entry) / entry) * 10_000);
  const bullish = isBullishCall(signal.direction);
  const directionalBps = bullish ? moveBps : -moveBps;
  // A flat market (directionalBps === 0) settles as correct — calls that pay
  // out only on a strict move would use `> 0` here. We keep `>= 0` so a perfect
  // hold isn't punished as a loss in the demo.
  const correct = directionalBps >= 0;
  const quoteContext = quote
    ? ` Quote: ${quote.source} observed ${new Date(quote.observedAt).toISOString()}.`
    : "";
  return {
    correct,
    pnlBps: directionalBps,
    exitPrice,
    reasoning:
      `${signal.market} settled at ${exitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}; ` +
      `entry was ${entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}. ` +
      `Move ${formatSignedBps(moveBps)} -> ${signal.direction} call ${correct ? "correct" : "wrong"}.` +
      quoteContext,
  };
}

function isBullishCall(direction: Direction): boolean {
  return direction === "LONG" || direction === "YES";
}

function formatSignedBps(bps: number): string {
  const pct = (bps / 100).toFixed(2);
  return bps >= 0 ? `+${pct}%` : `${pct}%`;
}

/**
 * For non-priceable signals (event markets, vol spreads), derive a deterministic
 * outcome from the signal's source hash so demo runs are reproducible. The
 * hash's first byte determines win/loss weighted by the published confidence so
 * higher-confidence calls win more often, matching how a real resolver should
 * behave when ground-truth is fuzzy.
 */
export function deterministicVerdict(signal: Signal): ResolutionVerdict {
  const byte = parseInt(signal.sourceHash.slice(2, 4), 16); // 0–255
  const threshold = Math.floor((signal.confidenceBps / 10_000) * 256);
  const correct = byte < threshold;
  const magnitude = 50 + (byte % 250); // 50–299 bps
  const bullish = isBullishCall(signal.direction);
  const directionalBps = correct ? magnitude : -magnitude;
  const exitPrice =
    signal.entryPrice * (1 + (bullish ? directionalBps : -directionalBps) / 10_000);
  return {
    correct,
    pnlBps: directionalBps,
    exitPrice,
    reasoning:
      `No spot quote available for ${signal.market}; resolved deterministically from source hash ` +
      `against ${(signal.confidenceBps / 100).toFixed(0)}% published confidence.`,
  };
}

export type ResolvableSignal = Signal & { onchainId: number };

export function isResolvable(signal: Signal, now = Date.now()): signal is ResolvableSignal {
  if (signal.status !== "active") return false;
  if (typeof signal.onchainId !== "number") return false;
  return new Date(signal.expiresAt).getTime() <= now;
}

/**
 * Build a verdict for a single signal: try the price feed first, fall back to
 * the deterministic path if the market isn't priceable.
 */
export async function resolveVerdict(signal: Signal): Promise<{
  verdict: ResolutionVerdict;
  quote?: MarketQuote;
}> {
  const quote = await fetchMarketQuote(signal.market, new Date(signal.expiresAt));
  if (quote) {
    return { verdict: judgeOutcome(signal, quote.price, quote), quote };
  }
  return { verdict: deterministicVerdict(signal) };
}
