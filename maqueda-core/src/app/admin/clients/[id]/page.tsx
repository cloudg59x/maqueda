import { notFound } from "next/navigation";
import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { getClientAuditLog, getClientBalanceHistory, getClientDetail } from "@/actions/client-actions";
import { getAlerts } from "@/actions/alert-actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { AuditLogTable } from "@/components/audit-log-table";
import { BalanceHistoryChart } from "@/components/clients/balance-history-chart";
import { ClientActionsMenu } from "@/components/clients/client-actions-menu";
import { ClientStatusBadge, clientStatus } from "@/components/clients/client-status-badge";
import { WalletAddress } from "@/components/clients/wallet-address";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getChainName } from "@/lib/chains";
import { formatDateTime, timeAgo } from "@/lib/format";
import { formatTokenAmount, formatUsd } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClientDetail(id);
  if (!client) notFound();
  const [history, alerts, auditLog] = await Promise.all([
    getClientBalanceHistory(id),
    getAlerts({ clientId: id, limit: 100 }),
    getClientAuditLog(id),
  ]);
  const DeviceIcon = client.deviceType === "mobile" ? SmartphoneIcon : client.deviceType === "tablet" ? TabletIcon : MonitorIcon;

  return (
    <TooltipProvider>
      <AutoRefresh seconds={30} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Client</h1>
            <ClientStatusBadge status={clientStatus(client)} />
          </div>
          <WalletAddress address={client.walletAddress} chainId={client.network} full className="text-base" />
          <p className="text-sm text-muted-foreground">
            {getChainName(client.network)} · first seen {formatDateTime(client.firstSeen)} · last seen {timeAgo(client.lastSeen)}
          </p>
        </div>
        <ClientActionsMenu client={client} variant="buttons" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total value</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{client.lastCheckedAt ? formatUsd(client.lastBalanceUsd) : "pending"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">checked {timeAgo(client.lastCheckedAt)}</CardContent>
        </Card>
        {client.balances.map((b) => (
          <Card key={b.tokenId}>
            <CardHeader className="pb-2">
              <CardDescription>{b.symbol}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{b.takenAt ? formatTokenAmount(b.raw, b.decimals, b.symbol === "ETH" ? 6 : 2) : "—"}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{b.takenAt ? `${formatUsd(b.usd)} · changed ${timeAgo(b.takenAt)}` : "no snapshot yet"}</CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="balances" className="w-full">
        <TabsList>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="alerts">Alerts {alerts.length > 0 && <span className="ml-1 text-muted-foreground">({alerts.length})</span>}</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="device">Device &amp; location</TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Total USD, last 30 days</CardTitle>
              <CardDescription>Step chart built from balance snapshots. A point is recorded only when a balance changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <BalanceHistoryChart points={history} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsTable alerts={alerts} showClient={false} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTable rows={auditLog} />
        </TabsContent>

        <TabsContent value="device">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-4 pt-6 sm:grid-cols-2">
              <Field label="Device">
                <span className="inline-flex items-center gap-2">
                  <DeviceIcon className="size-4 text-muted-foreground" />
                  {[client.deviceType, client.os, client.browser].filter(Boolean).join(" · ") || "Unknown"}
                </span>
              </Field>
              <Field label="Screen">{client.screenInfo ?? "—"}</Field>
              <Field label="Location">{[client.city, client.region, client.country].filter(Boolean).join(", ") || "Unknown"}</Field>
              <Field label="Coordinates">{client.latitude != null && client.longitude != null ? `${client.latitude}, ${client.longitude}` : "—"}</Field>
              <Field label="IP address">{client.ipAddress ?? "—"}</Field>
              <Field label="Chain reported by wallet">{getChainName(client.network)}</Field>
              <Field label="User agent" className="sm:col-span-2">
                <span className="break-all font-mono text-xs">{client.userAgent ?? "—"}</span>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
