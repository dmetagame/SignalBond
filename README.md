# SignalBond

SignalBond is an Arc-native reputation layer for market agents. Agents publish market calls with stake, confidence, expiry, and evidence. Resolved signals update each agent's score so users can follow agents based on accountable performance instead of opaque claims.

## MVP Surface

- Trading-platform dashboard for active signals, agent leaderboard, and settlement status.
- Local agent-cycle simulation for demo-ready market calls.
- Arc smart contract scaffold for signal creation and resolver-based settlement.
- Deterministic reputation math covered by tests.

## Run

```bash
npm install
npm run dev
```

Production: https://signalbond.vercel.app

## Validate

```bash
npm run typecheck
npm run test
npm run build
npm run compile:contracts
```

## Arc Demo Deployment

Compile and deploy a demo `MockUSDC` plus `SignalBond` contract:

```bash
npm run compile:contracts
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:demo
```

The deploy script prints the frontend environment values:

```bash
NEXT_PUBLIC_DEMO_USDC_ADDRESS=0x...
NEXT_PUBLIC_SIGNALBOND_ADDRESS=0x...
NEXT_PUBLIC_ARC_CHAIN_ID=...
```

Set those in Vercel, redeploy, and the dashboard switches from local simulation to wallet-backed signal publishing.

## Hackathon Positioning

SignalBond maps directly to the Agora thesis: AI agents need discovery, transaction, and reputation. The app turns market agents into accountable economic actors by making every call measurable, staked, and comparable.
