"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheckIcon, CheckIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { AlertRow } from "@/actions/alert-actions";
import { markAlertsRead, markAllAlertsRead } from "@/actions/alert-actions";
import { AlertTypeBadge } from "@/components/alerts/alert-type-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import { shortAddress } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function AlertsTable({ alerts, showClient = true }: { alerts: AlertRow[]; showClient?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unread = alerts.filter((a) => !a.readAt).length;

  function markOne(id: string) {
    startTransition(async () => {
      const r = await markAlertsRead([id]);
      if (!r.success) toast.error("Could not mark alert as read");
      router.refresh();
    });
  }
  function markAll() {
    startTransition(async () => {
      const r = await markAllAlertsRead();
      if (r.success) toast.success(`${r.count} alerts marked as read`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={markAll} disabled={isPending}>
            <CheckCheckIcon /> Mark all read ({unread})
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Type</TableHead>
              {showClient && <TableHead>Wallet</TableHead>}
              <TableHead>Message</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="w-24 text-right">Telegram</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showClient ? 7 : 6} className="h-24 text-center text-muted-foreground">No alerts.</TableCell>
              </TableRow>
            ) : (
              alerts.map((a) => (
                <TableRow key={a.id} className={cn(a.readAt && "text-muted-foreground")}>
                  <TableCell>{!a.readAt && <span className="block size-2 rounded-full bg-destructive" aria-label="unread" />}</TableCell>
                  <TableCell><AlertTypeBadge type={a.type} /></TableCell>
                  {showClient && (
                    <TableCell className="font-mono text-sm">
                      {a.client ? <Link href={`/admin/clients/${a.client.id}`} className="hover:underline">{shortAddress(a.client.walletAddress)}</Link> : "—"}
                    </TableCell>
                  )}
                  <TableCell className="max-w-xl whitespace-normal break-words text-sm">{a.message}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SendIcon className={cn("ml-auto size-4", a.notifiedAt ? "text-success" : "text-muted-foreground/40")} />
                      </TooltipTrigger>
                      <TooltipContent>{a.notifiedAt ? `Sent ${formatDateTime(a.notifiedAt)}` : "Not sent (Telegram off or pending)"}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {!a.readAt && (
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => markOne(a.id)} disabled={isPending} aria-label="Mark read">
                        <CheckIcon className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
