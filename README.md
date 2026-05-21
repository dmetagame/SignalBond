# SignalBond

**An Arc-native reputation layer for AI market agents.**

> Agora Agents Hackathon — Canteen × Circle, May 11–25 2026.
> Live: https://signalbond.vercel.app

AI agents are becoming economic actors, but the rails for accountability don't exist on most chains. SignalBond turns market agents into measurable counterparties: every call is staked in USDC, expires onchain, and resolves into an explorable reputation score. Follow agents based on accountable performance instead of opaque claims.

## What it does (60-second demo)

1. **Connect wallet** on Arc Testnet (chain `0x4cef52`). The sidebar prompts a one-time demo USDC claim.
2. Hit **Run Agent Cycle** in the dashboard header. A Claude Haiku-powered desk picks one of four agents (Macro / Perp / Polymath / Arb) and proposes a staked, reasoning-backed call.
3. The **proposal modal** shows the call (market, side, confidence, stake, entry → target, sources). Click **Publish** to commit to Arc: USDC `approve` → `createSignal` → onchain confirmation, with an arcscan link in the success banner.
4. Once the signal expires, click **Resolve** in the Signal Book. The resolver settles it onchain, the contract pays back stake on a win, and the agent's reputation updates against the contract formula.
5. The **Settlement** and **Resolver Log** pages, plus the notifications bell, surface every settlement with its arcscan tx link.

## Why this fits Agora

- **Discovery** — Agent Book + ranked Agents page; signals are filterable by status and market.
- **Transaction** — Real `createSignal` + `resolveSignal` on Arc, USDC-staked. ~$0.01 fees, sub-second finality.
- **Reputation** — `getScore(agentId)` returns the canonical reputation. The dashboard's offchain `calculateScore` mirrors the contract formula exactly (`winRateBps + cumPnL/4`) so the UI never drifts from chain state.
- **AI agents** — `proposeSignal` is implemented as a Claude Haiku tool call on the server (`/api/agent-scan`) with cached system + agent-roster blocks. Falls back to deterministic templates if `ANTHROPIC_API_KEY` is unset.

## Tech stack

- **Frontend** — Next.js 16 (App Router, route groups), React 19, Tailwind v4 (CSS-variable tokens), Recharts, Lucide icons.
- **Onchain** — Solidity 0.8.30 (`SignalBond.sol`, `MockUSDC.sol`), viem 2.x for RPC and wallet flows.
- **Agent runtime** — Anthropic SDK (`@anthropic-ai/sdk`) with tool-use for structured proposals, prompt caching on the static system blocks.
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
| `ANTHROPIC_API_KEY` | Server only | Enables real Claude Haiku agent proposals. Without it, `/api/agent-scan` falls back to deterministic templates. |
| `ARC_RPC_URL` | Server only | Canteen Arc RPC (keyed). Do **not** expose via `NEXT_PUBLIC_*`. |
| `NEXT_PUBLIC_ARC_CHAIN_ID` | Browser | Defaults to `5042002`. |
| `NEXT_PUBLIC_SIGNALBOND_ADDRESS` | Browser | Deployed `SignalBond` address. |
| `NEXT_PUBLIC_DEMO_USDC_ADDRESS` | Browser | Deployed `MockUSDC` address. |
| `NEXT_PUBLIC_ARC_EXPLORER` | Browser | Optional. Defaults to `https://testnet.arcscan.app`. |

## Arc deployment

Compile and deploy `MockUSDC` + `SignalBond`:

```bash
npm run compile:contracts
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:demo
```

The deploy script prints the four `NEXT_PUBLIC_*` values plus `ARC_RPC_URL`. Set them in Vercel and redeploy. The dashboard automatically switches from local simulation to wallet-backed onchain publishing.

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
    DashboardProvider.tsx     Client context — wallet, signals, proposals, settlement; orchestrates connect/claim/runAgentCycle/publishProposal/resolveSignal
    DashboardLayout.tsx       Client shell — Sidebar + Topbar + mobile drawer state
    Sidebar.tsx               Routing nav + connect/claim card
    Topbar.tsx                Search, theme toggle, notifications, wallet pill
    ProposalModal.tsx         Reasoning preview + Publish (approve → createSignal → wait)
    SignalDetailDrawer.tsx    Per-signal proof view with arcscan links
    NotificationsDropdown.tsx Settlement + tx feed
    PublishSuccessBanner.tsx
    SettlementSuccessBanner.tsx
    LineChartCard.tsx / WeekdayBars / Gauge / SegmentedBreakdown / KpiCard / SignalTable / Card / DeltaPill / SectionHeader / SignalBondMark / ThemeToggle

  lib/
    agent-scan.ts             Deterministic template generator (fallback)
    agent-scan-llm.ts         Claude Haiku tool-use proposer with prompt caching
    dashboard-actions.ts      viem-based contract calls (publish/resolve/claim/ensureArc)
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

contracts/
  SignalBond.sol              Stake escrow, resolver-gated settlement, reputation accounting
  MockUSDC.sol                Demo stake token with one-shot claim faucet

scripts/
  deploy-demo.ts              Deploy MockUSDC + SignalBond
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

## Roadmap (RFB-adjacent)

- **CCTP** — bridge USDC from Ethereum testnet to Arc as part of the connect flow.
- **App Kit** — sponsored-gas wallet onboarding for first-time agent followers.
- **Gateway** — quote-driven stake sizing for cross-venue calls.
- **Multi-agent aggregation** — reputation-weighted aggregate side per market.

## License

MIT. Built for the Agora Agents Hackathon.
