"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AlertBell, type AlertBellProps } from "@/components/alerts/alert-bell";

const LABELS: Record<string, string> = {
  admin: "Dashboard",
  clients: "Clients",
  alerts: "Alerts",
  users: "Users",
  settings: "Settings",
};

export function SiteHeader({ bell }: { bell: AlertBellProps }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // ["admin", "clients", "<id>"]

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((seg, i) => {
            const href = "/" + segments.slice(0, i + 1).join("/");
            const isLast = i === segments.length - 1;
            const label = LABELS[seg] ?? (seg.length > 12 ? `${seg.slice(0, 8)}…` : seg);
            return (
              <Fragment key={href}>
                {i > 0 && <BreadcrumbSeparator className="hidden md:flex" />}
                <BreadcrumbItem className={i === 0 ? "hidden md:flex" : undefined}>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={href}>{label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <AlertBell {...bell} />
      </div>
    </header>
  );
}
