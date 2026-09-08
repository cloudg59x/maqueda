import { requireUser } from "@/lib/auth";
import { getChain } from "@/lib/chains";
import { getUnreadAlertCount, getRecentAlerts } from "@/actions/alert-actions";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, recent] = await Promise.all([getUnreadAlertCount(), getRecentAlerts(5)]);
  const chain = getChain(process.env.CHAIN_ID);
  const chainLabel = chain ? chain.name : "Chain not configured";

  return (
    <SidebarProvider>
      <AppSidebar user={user} unreadAlerts={unread} chainLabel={chainLabel} />
      <SidebarInset>
        <SiteHeader bell={{ unread, recent }} />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
