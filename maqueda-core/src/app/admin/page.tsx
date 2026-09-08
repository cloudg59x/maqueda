import Link from "next/link";
import { ActivityIcon, AlertTriangleIcon, BellIcon, WalletIcon } from "lucide-react";
import { getDashboardStats } from "@/actions/dashboard-actions";
import { getRecentAlerts } from "@/actions/alert-actions";
import { AlertTypeBadge } from "@/components/alerts/alert-type-badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, timeAgo } from "@/lib/format";
import { formatUsd, shortAddress } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([getDashboardStats(), getRecentAlerts(10)]);
  if (!stats) return null;

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader title="Dashboard" description="Monitored wallets, alerts and worker health at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={WalletIcon} label="Wallets seen" value={stats.activeClients} hint={`connected to the dApp, not enrolled · ${stats.inactiveClients} deactivated`} href="/admin/clients" />
        <Stat
          icon={AlertTriangleIcon}
          label="Below threshold"
          value={stats.belowThreshold}
          hint={stats.thresholdUsd > 0 ? `threshold ${formatUsd(stats.thresholdUsd)}` : "threshold off: alerting on every change"}
          href="/admin/clients?status=below"
          tone={stats.belowThreshold > 0 ? "danger" : "default"}
        />
        <Stat icon={BellIcon} label="Unread alerts" value={stats.unreadAlerts} hint="across all wallets" href="/admin/alerts?unread=1" tone={stats.unreadAlerts > 0 ? "warn" : "default"} />
        <Stat icon={ActivityIcon} label="Total monitored" value={formatUsd(stats.totalUsd)} hint="sum of active wallets" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent alerts</CardTitle>
              <CardDescription>Latest 10 events from the monitor</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/alerts">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No alerts yet. They appear here once the worker detects a change.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((a) => (
                  <li key={a.id} className={cn("flex items-start gap-3 py-2.5", a.readAt && "opacity-60")}>
                    <AlertTypeBadge type={a.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.client ? (
                          <Link href={`/admin/clients/${a.client.id}`} className="font-mono hover:underline">{shortAddress(a.client.walletAddress)}</Link>
                        ) : (
                          "system"
                        )}{" "}
                        · {timeAgo(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Worker</CardTitle>
            <CardDescription>Balance monitor process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", stats.worker.healthy ? "bg-success" : "bg-destructive")} />
              <span className="font-medium">{stats.worker.healthy ? "Running" : "Not running"}</span>
            </div>
            <Row label="Last tick" value={timeAgo(stats.worker.lastRunAt)} />
            <Row label="Tick duration" value={formatDuration(stats.worker.lastDurationMs)} />
            <Row label="Poll interval" value={`${stats.pollIntervalSec}s`} />
            {stats.worker.lastError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {stats.worker.lastError}
              </div>
            )}
            {!stats.worker.healthy && (
              <p className="text-xs text-muted-foreground">
                Start it with <code className="rounded bg-muted px-1 py-0.5">npm run dev:worker</code> or check the worker container.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "default" | "danger" | "warn";
}) {
  const body = (
    <Card className={cn("h-full transition-colors", href && "hover:bg-accent/40")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className={cn("size-4", tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tabular-nums", tone === "danger" && "text-destructive")}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
