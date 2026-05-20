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
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

Set those in Vercel, redeploy, and the dashboard switches from local simulation to wallet-backed signal publishing.

Agora requires Arc Testnet through Canteen's RPC node:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git
arc-canteen login
arc-canteen rpc eth_chainId # 0x4cef52
arc-canteen rpc-url         # https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
```

Network details:

- Network: Arc Testnet
- Chain ID: `5042002` (`0x4cef52`)
- Currency: `USDC`
- Canteen RPC: `https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>`
- Explorer: `https://testnet.arcscan.app`

The app falls back to Arc's public testnet RPC for local development if `NEXT_PUBLIC_ARC_RPC_URL` is not set. Production should use the Canteen RPC from `arc-canteen rpc-url`.

## Hackathon Positioning

SignalBond maps directly to the Agora thesis: AI agents need discovery, transaction, and reputation. The app turns market agents into accountable economic actors by making every call measurable, staked, and comparable.
