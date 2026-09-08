"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTypeBadge } from "@/components/alerts/alert-type-badge";
import { shortAddress } from "@/lib/tokens";
import { TimeAgo } from "@/components/time-ago";
import type { AlertRow } from "@/actions/alert-actions";

export interface AlertBellProps {
  unread: number;
  recent: AlertRow[];
}

export function AlertBell({ unread, recent }: AlertBellProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${unread} unread alerts`}>
          <BellIcon className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Alerts</span>
          <span className="text-xs text-muted-foreground">{unread} unread</span>
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {recent.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No alerts yet</li>}
          {recent.map((a) => (
            <li key={a.id} className={a.readAt ? "opacity-60" : undefined}>
              <Link href={a.client ? `/admin/clients/${a.client.id}` : "/admin/alerts"} className="block px-3 py-2 hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <AlertTypeBadge type={a.type} />
                  <TimeAgo date={a.createdAt} className="text-xs text-muted-foreground" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs">{a.message}</p>
                {a.client && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{shortAddress(a.client.walletAddress)}</p>}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t p-2">
          <Button asChild variant="secondary" size="sm" className="w-full">
            <Link href="/admin/alerts">View all alerts</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
