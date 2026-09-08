"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, LayoutDashboardIcon, SettingsIcon, UsersIcon, WalletIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { CurrentUser } from "@/lib/auth";

const NAV = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboardIcon, exact: true },
  { title: "Clients", url: "/admin/clients", icon: WalletIcon },
  { title: "Alerts", url: "/admin/alerts", icon: BellIcon },
  { title: "Users", url: "/admin/users", icon: UsersIcon },
];

const SECONDARY = [{ title: "Settings", url: "/admin/settings", icon: SettingsIcon }];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: CurrentUser;
  unreadAlerts: number;
  chainLabel: string;
}

export function AppSidebar({ user, unreadAlerts, chainLabel, ...props }: AppSidebarProps) {
  const pathname = usePathname();
  const isActive = (url: string, exact?: boolean) => (exact ? pathname === url : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/admin">
                <div className="flex size-10 shrink-0 items-center justify-center group-data-[collapsible=icon]:size-5">
                  <Logo className="size-10 group-data-[collapsible=icon]:size-5" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-semibold tracking-tight">Maqueda</span>
                  <span className="truncate text-xs text-muted-foreground">{chainLabel}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitor</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.url === "/admin/alerts" && unreadAlerts > 0 && (
                    <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
