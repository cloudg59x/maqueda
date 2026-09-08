import { redirect } from "next/navigation";
import { getMonitoredTokens, loadSettings } from "@/actions/settings-actions";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { TokensTable } from "@/components/settings/tokens-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getChainName } from "@/lib/chains";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/unauthorized");
  const [settings, tokens] = await Promise.all([loadSettings(), getMonitoredTokens()]);

  return (
    <>
      <PageHeader title="Settings" description="Monitoring rules, notifications and tokens. Every change is audit-logged." />
      <SettingsForm initial={settings} />
      <Card>
        <CardHeader>
          <CardTitle>Monitored tokens</CardTitle>
          <CardDescription>
            The worker only reads tokens on the chain set by <code className="rounded bg-muted px-1 py-0.5 text-xs">CHAIN_ID</code> ({getChainName(process.env.CHAIN_ID)}). Other chains are listed for reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokensTable tokens={tokens} />
        </CardContent>
      </Card>
    </>
  );
}
