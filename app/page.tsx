import DashboardClient from "./dashboard-client";
import { serializeDashboard, type ChainState } from "./lib/chain-state";
import { contractsConfigured } from "./lib/contract";
import { readOnchainDashboard } from "./lib/onchain";
import { agents } from "./lib/seed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const initialChainState = await readInitialChainState();

  return <DashboardClient initialChainState={initialChainState} />;
}

async function readInitialChainState(): Promise<ChainState | undefined> {
  if (!contractsConfigured) {
    return undefined;
  }

  try {
    return serializeDashboard(await readOnchainDashboard(agents));
  } catch {
    return undefined;
  }
}
