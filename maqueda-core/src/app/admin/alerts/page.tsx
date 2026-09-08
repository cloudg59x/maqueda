import Link from "next/link";
import type { AlertType } from "@prisma/client";
import { getAlerts } from "@/actions/alert-actions";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

const TYPES: Array<{ value: AlertType | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "BELOW_THRESHOLD", label: "Below threshold" },
  { value: "BACK_ABOVE", label: "Back above" },
  { value: "BALANCE_CHANGED", label: "Balance changed" },
  { value: "WORKER_ERROR", label: "Worker errors" },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ type?: string; unread?: string }> }) {
  const sp = await searchParams;
  const type = (TYPES.some((t) => t.value === sp.type) ? sp.type : "ALL") as AlertType | "ALL";
  const unreadOnly = sp.unread === "1";
  const alerts = await getAlerts({ type, unreadOnly });

  const href = (t: AlertType | "ALL", u: boolean) => {
    const q = new URLSearchParams();
    if (t !== "ALL") q.set("type", t);
    if (u) q.set("unread", "1");
    const s = q.toString();
    return `/admin/alerts${s ? `?${s}` : ""}`;
  };

  return (
    <TooltipProvider>
      <AutoRefresh seconds={30} />
      <PageHeader title="Alerts" description="Everything the monitor flagged. Telegram column shows delivery state." />
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <Button key={t.value} asChild size="sm" variant={t.value === type ? "default" : "outline"}>
            <Link href={href(t.value, unreadOnly)}>{t.label}</Link>
          </Button>
        ))}
        <Button asChild size="sm" variant={unreadOnly ? "default" : "outline"} className={cn("ml-auto")}>
          <Link href={href(type, !unreadOnly)}>Unread only</Link>
        </Button>
      </div>
      <AlertsTable alerts={alerts} />
    </TooltipProvider>
  );
}
