import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuth } = await verifySession();
  
  if (!isAuth) {
    redirect("/auth/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col pl-0 md:pl-[16rem] pt-4 md:pt-0 w-full">
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 w-full">
          <div className="w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}