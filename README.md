# SignalBond

**An Arc-native reputation layer for AI market agents.**

> Agora Agents Hackathon — Canteen × Circle, May 11–25 2026.
> Live: https://signalbond.vercel.app

AI agents are becoming economic actors, but the rails for accountability don't exist on most chains. SignalBond turns market agents into measurable counterparties: every call is staked in USDC, expires onchain, and resolves into an explorable reputation score. Follow agents based on accountable performance instead of opaque claims.

## What it does (60-second demo)

1. **Connect wallet** on Arc Testnet (chain `0x4cef52`). The sidebar links to Circle's faucet (`faucet.circle.com`, 20 USDC every 2h) so the user can top up their stake balance.
2. Hit **Run Agent Cycle** in the dashboard header. The server-side proposal desk uses Groq + Llama 3.3 70B by default, Claude Haiku as an optional fallback, and deterministic templates only when no LLM runtime is available.
3. The **proposal modal** shows the call (market, side, confidence, stake, entry → target, sources). Click **Publish** to commit to Arc: USDC `approve` → `createSignal` → onchain confirmation, with an arcscan link in the success banner.
4. Once the signal expires, the bearer-authenticated resolver settles it onchain using expiry-time CoinGecko evidence where available. The contract pays back stake on a win; losing stakes move into an explicit slashed reserve withdrawable to the treasury.
5. The **Settlement** and **Resolver Log** pages, plus the notifications bell, surface every settlement with its arcscan tx link.

## Why this fits Agora

- **Discovery** — Agent Book + ranked Agents page; signals are filterable by status and market.
- **Transaction** — Real `createSignal` + `resolveSignal` on Arc, USDC-staked. ~$0.01 fees, sub-second finality.
- **Reputation** — `getScore(agentId)` returns the canonical reputation. The dashboard's offchain `calculateScore` mirrors the contract formula exactly (`winRateBps + cumPnL/4`) so the UI never drifts from chain state. Losing bonds are accounted in `slashedStakeBalance()` instead of being silently stranded.
- **AI agents** — `proposeSignal` is implemented as a structured LLM call on the server (`/api/agent-scan`). Default provider is **Groq + Llama 3.3 70B** (free tier, sub-second), with **Claude Haiku 4.5** as an alternative when `ANTHROPIC_API_KEY` is set. Falls back to deterministic templates if neither is configured. The response includes an `agentRuntime` field so judges can verify which path served the proposal.

## Tech stack

- **Frontend** — Next.js 16 (App Router, route groups), React 19, Tailwind v4 (CSS-variable tokens), Recharts, Lucide icons.
- **Onchain** — Solidity 0.8.30 (`SignalBond.sol`), real Arc Testnet USDC, viem 2.x for RPC and wallet flows.
- **Agent runtime** — Groq SDK (`groq-sdk`, default) or Anthropic SDK (`@anthropic-ai/sdk`) with structured proposals; Anthropic uses prompt caching on the static system blocks.
- **RPC** — Canteen Arc node (server-side, keyed) with public Arc fallback for browser writes.

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

```bash
npm run typecheck
npm run test
npm run build
npm run compile:contracts
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Server only | **Recommended free path.** Enables Groq + Llama 3.3 70B Versatile agent proposals. Get a key at https://console.groq.com. |
| `ANTHROPIC_API_KEY` | Server only | Alternative paid path. Enables Claude Haiku 4.5 proposals. Used only if `GROQ_API_KEY` is unset (or via `?provider=anthropic`). |
| `GROQ_MODEL` | Server only | Optional. Defaults to `llama-3.3-70b-versatile`. |
| `ARC_RPC_URL` | Server only | Canteen Arc RPC (keyed). Do **not** expose via `NEXT_PUBLIC_*`. |
| `RESOLVER_PRIVATE_KEY` | Server only | Wallet authorized as contract resolver/owner for automated settlement. |
| `CRON_SECRET` | Server only | Required bearer token for resolver execution via Vercel Cron/operator calls. |
| `NEXT_PUBLIC_ARC_CHAIN_ID` | Browser | Defaults to `5042002`. |
| `NEXT_PUBLIC_SIGNALBOND_ADDRESS` | Browser | Deployed `SignalBond` address. |
| `NEXT_PUBLIC_USDC_ADDRESS` | Browser | Optional override. Defaults to real Arc Testnet USDC from Circle App Kit. |
| `NEXT_PUBLIC_DEMO_USDC_ADDRESS` | Browser | Legacy alias honored only as an override during migration. |
| `NEXT_PUBLIC_ARC_EXPLORER` | Browser | Optional. Defaults to `https://testnet.arcscan.app`. |

Without any LLM key set, `/api/agent-scan` still works — it serves deterministic templates so the UI stays demoable. Production responses include an `agentRuntime` field (`groq:llama-3.3-70b-versatile` / `claude-haiku-4-5` / `deterministic-scan-v1`) so judges can verify which path is live.

## Arc deployment

Compile and deploy `SignalBond` against real Arc Testnet USDC:

```bash
npm run compile:contracts
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:demo
```

The deploy script defaults `STAKE_TOKEN_ADDRESS` to Arc Testnet USDC (`0x3600000000000000000000000000000000000000`) and prints the public Vercel values. Set `NEXT_PUBLIC_SIGNALBOND_ADDRESS`, `NEXT_PUBLIC_ARC_CHAIN_ID`, `ARC_RPC_URL`, `RESOLVER_PRIVATE_KEY`, and `CRON_SECRET` in Vercel, then redeploy. The dashboard automatically switches from local simulation to wallet-backed onchain publishing.

Arc Testnet through Canteen's RPC node (recommended):

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git
arc-canteen login
arc-canteen rpc eth_chainId   # 0x4cef52
arc-canteen rpc-url           # https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

Network details:

- Network: **Arc Testnet**
- Chain ID: `5042002` (`0x4cef52`)
- Native currency: USDC
- Explorer: https://testnet.arcscan.app
- Canteen RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>` via server-only `ARC_RPC_URL`
- Public fallback: `https://rpc.testnet.arc.network`

Wallet writes use the connected provider; reads server-side route through the keyed Canteen URL.

## Architecture

```
app/
  (dashboard)/                Route group — every page wears the dashboard chrome
    layout.tsx                Server: fetch initial chain state, mount DashboardProvider + DashboardLayout + ProposalModal + SignalDetailDrawer
    page.tsx                  /        Main dashboard (KPIs, performance, composition, weekday, gauge, agent assistant, signal book)
    signals/                  /signals     Filterable Signal Book
    agents/                   /agents      Ranked agent cards
    markets/                  /markets     Market tape
    settlement/               /settlement  Resolved signals + resolver/owner/last tx
    onchain/
      contracts/              /onchain/contracts        Deployed addresses with arcscan + copy
      transactions/           /onchain/transactions     Live tx state + arcscan
      resolver-log/           /onchain/resolver-log     Chronological settlement timeline
    analytics/                /analytics                Aggregate charts
    followed-agents/          /followed-agents          Placeholder for wallet-bound following

  components/dashboard/
    DashboardProvider.tsx     Client context — wallet, signals, proposals, settlement; orchestrates connect/faucet/runAgentCycle/publishProposal/resolveSignal
    DashboardLayout.tsx       Client shell — Sidebar + Topbar + mobile drawer state
    Sidebar.tsx               Routing nav + connect/faucet card
    Topbar.tsx                Search, theme toggle, notifications, wallet pill
    ProposalModal.tsx         Reasoning preview + Publish (approve → createSignal → wait)
    SignalDetailDrawer.tsx    Per-signal proof view with arcscan links
    NotificationsDropdown.tsx Settlement + tx feed
    PublishSuccessBanner.tsx
    SettlementSuccessBanner.tsx
    LineChartCard.tsx / WeekdayBars / Gauge / SegmentedBreakdown / KpiCard / SignalTable / Card / DeltaPill / SectionHeader / SignalBondMark / ThemeToggle

  lib/
    agent-scan.ts             Deterministic template generator (fallback)
    agent-scan-llm.ts         Claude Haiku structured proposer with prompt caching
    agent-scan-groq.ts        Groq + Llama 3.3 70B structured proposer (default)
    agent-scan-schema.ts      Shared schema + coercion for LLM proposal fields
    dashboard-actions.ts      viem-based contract calls (publish/resolve/ensureArc)
    chain-state.ts            Server-side initial dashboard read
    onchain.ts                Public client + waitForOnchainTx + agentHash
    reputation.ts             Mirrors contract reputation formula
    composition.ts            Desk-category roll-up
    performance.ts            Stake-weighted PnL series
    weekday.ts                Signal-by-weekday histogram
    kpis.ts                   Four headline KPIs
    explorer.ts               arcTxUrl / arcAddressUrl
    seed.ts                   Demo agents + signals + market tape
    contract.ts               viem chain config + ABIs

  api/
    agent-scan/route.ts       LLM-first signal proposal, deterministic fallback
    chain-state/route.ts      Browser refresh endpoint
    resolve/route.ts          Dry-run resolver preview; bearer-authenticated execution

contracts/
  SignalBond.sol              Stake escrow, resolver-gated settlement, slashed reserve, reputation accounting

scripts/
  deploy-demo.ts              Deploy SignalBond against Arc Testnet USDC by default
  deploy-signalbond.ts        Just the SignalBond contract
  seed-demo-signals.ts        Optional onchain seed
```

## Reputation math

The contract is the source of truth (`SignalBond.sol::_calculateReputation`):

```
winRateBps   = (correctSignals * 10000) / resolvedSignals
pnlComponent = cumulativePnLBps / 4
reputation   = winRateBps + pnlComponent
```

The dashboard divides by 100 for display (so the headline reads `72.5` rather than `7250 bps`). `lib/reputation.onchainReputation()` returns the raw int256 directly for explorer-equivalence.

## Settlement economics

The resolver first asks CoinGecko for a historical price range around the signal expiry and uses the closest point as settlement evidence. If that range is unavailable, it transparently falls back to a live spot quote; markets without a reliable price mapping use a deterministic source-hash fallback so the demo can still close the loop.

Correct signals return the full USDC stake to the publisher. Incorrect signals increment `slashedStakeBalance()` and emit `StakeSlashed`; the owner can withdraw that reserve to `treasury()` via `withdrawSlashedStake(amount)`.

## Circle stack integration

- **App Kit** — `@circle-fin/app-kit` is installed and `lib/app-kit.ts` re-exports the canonical chain definitions Circle ships for Arc Testnet, Ethereum Sepolia, and Base Sepolia. Every Circle-touching surface — `lib/contract.ts` (Arc chain config, USDC address), `lib/cctp.ts` (TokenMessenger / MessageTransmitter / domain IDs), `lib/unified-balance.ts` (multi-chain USDC reads) — sources its constants from App Kit so the integration tracks Circle's published numbers verbatim. The bridge/earn action SDKs ship as server-side patterns with private-key adapters, so SignalBond keeps signing in the user's wallet and calls the underlying CCTP V2 contracts that App Kit wraps.
- **CCTP V2** — `/bridge` does a one-signature USDC transfer from Ethereum Sepolia to Arc Testnet via `depositForBurnWithHook` on App Kit's published TokenMessengerV2 address with the `cctp-forward` hook. Circle's forwarder service relays the attestation to MessageTransmitterV2 on Arc and pays the destination mint. `lib/cctp.ts` owns the wiring; the page polls Circle's Iris sandbox API (`iris-api-sandbox.circle.com`) for live status.
- **Gateway (unified balance)** — the Unified Balance card on `/bridge` mirrors Circle Gateway's thesis: USDC across Ethereum Sepolia, Base Sepolia, and Arc Testnet acts as a single spendable pool. Reads come from `lib/unified-balance.ts` querying each chain's published USDC token directly via viem public clients, so it works for any wallet without a prior Gateway deposit. `@circle-fin/unified-balance-kit` is installed as the upgrade path for moving stake sourcing onto the SDK's deposit/spend primitives.
- **USDC** — the staking token is the real Arc Testnet USDC (system contract `0x3600…0000` per App Kit's `ArcTestnet.usdcAddress`). The sidebar links to `faucet.circle.com` for the canonical claim.
- **Multi-agent aggregation** — `/markets` + `/markets/[symbol]` compute reputation-weighted consensus per market across every signal that has touched it. Each contributor's vote is `reputation × (confidenceBps / 10000)`, signed by direction. This is the "agora" coordination layer: discovery + reputation + transaction in one view.

## Roadmap

- **Programmable Wallets** — Circle's wallet-as-a-service for sponsored gas and social login. Would replace the current `eth_requestAccounts` injection flow for users without MetaMask.
- **Bridge Kit server worker** — move the CCTP burn through `@circle-fin/bridge-kit` with a service-signed adapter for users who don't hold gas on Sepolia.
- **Gateway deposit + spend** — use the Unified Balance Kit's deposit primitives so SignalBond stakes can draw from any supported chain, not just Arc.

## License

MIT. Built for the Agora Agents Hackathon.
