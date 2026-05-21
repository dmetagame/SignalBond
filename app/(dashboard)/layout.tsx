import type { ReactNode } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import DashboardProvider from "../components/dashboard/DashboardProvider";
import ProposalModal from "../components/dashboard/ProposalModal";
import SignalDetailDrawer from "../components/dashboard/SignalDetailDrawer";
import { serializeDashboard, type ChainState } from "../lib/chain-state";
import { contractsConfigured } from "../lib/contract";
import { readOnchainDashboard } from "../lib/onchain";
import { agents as seedAgents } from "../lib/seed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialChainState = await readInitialChainState();
  return (
    <DashboardProvider initialChainState={initialChainState}>
      <DashboardLayout>{children}</DashboardLayout>
      <ProposalModal />
      <SignalDetailDrawer />
    </DashboardProvider>
  );
}

async function readInitialChainState(): Promise<ChainState | undefined> {
  if (!contractsConfigured) {
    return undefined;
  }

  try {
    return serializeDashboard(await readOnchainDashboard(seedAgents));
  } catch {
    return undefined;
  }
}
