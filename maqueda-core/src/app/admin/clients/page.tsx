import { getClientsWithBalances } from "@/actions/client-actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ClientsTable } from "@/components/clients/clients-table";
import { PageHeader } from "@/components/page-header";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  // "active" kept as an alias of "seen" for old links.
  const initialStatus =
    status === "seen" || status === "active" ? "seen" : status === "below" || status === "inactive" ? status : "ALL";
  const clients = await getClientsWithBalances();
  const tokenSymbols = clients[0]?.balances.map((b) => b.symbol) ?? [];

  return (
    <TooltipProvider>
      <AutoRefresh seconds={30} />
      <PageHeader title="Clients" description="Wallets that connected to the dApp, with live balances on the monitored chain." />
      <ClientsTable clients={clients} tokenSymbols={tokenSymbols} initialStatus={initialStatus} />
    </TooltipProvider>
  );
}
