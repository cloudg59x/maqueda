import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClients, activateClient, deactivateClient } from "@/actions/client-actions";
import { getNetworkName } from "@/lib/networks";
import { 
  CalendarIcon, 
  GlobeIcon, 
  MonitorIcon, 
  SmartphoneIcon, 
  TabletIcon,
  ActivityIcon,
  WifiIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon
} from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function ClientsPage() {
  const { success, data: clients } = await getClients();
  
  if (!success) {
    return <div>Error loading clients</div>;
  }

  // Ensure clients is an array, even if data is undefined
  const clientsArray = clients || [];

  // Helper function to format device type icons
  const getDeviceTypeIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <SmartphoneIcon className="w-4 h-4" />;
      case 'tablet':
        return <TabletIcon className="w-4 h-4" />;
      default:
        return <MonitorIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Connected Wallets</h2>
            <p className="text-muted-foreground">
              View and manage connected client wallets
            </p>
          </div>
          <form action={async () => {
            "use server";
            revalidatePath('/admin/clients');
          }}>
            <Button type="submit" variant="outline">
              Refresh
            </Button>
          </form>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clients List</CardTitle>
            <CardDescription>Manage connected wallet clients</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsArray.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <WifiIcon className="w-4 h-4 text-muted-foreground" />
                        <span>{client.walletAddress.substring(0, 6)}...{client.walletAddress.substring(client.walletAddress.length - 4)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GlobeIcon className="w-4 h-4 text-muted-foreground" />
                        <span>{client.network ? getNetworkName(client.network) : 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-4 h-4 text-muted-foreground" />
                        <span>{client.city ? `${client.city}, ${client.country}` : client.country || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDeviceTypeIcon(client.deviceType || '')}
                        <span>{client.os} / {client.browser}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        <span>{new Date(client.lastSeen).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(client.lastSeen).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={client.isActive ? 'default' : 'secondary'}>
                          <ActivityIcon className="w-3 h-3 mr-1" />
                          {client.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <form action={async () => {
                          "use server";
                          if (client.isActive) {
                            await deactivateClient(client.id);
                          } else {
                            await activateClient(client.id);
                          }
                          revalidatePath('/admin/clients');
                        }}>
                          <Button 
                            type="submit" 
                            size="sm" 
                            variant="outline"
                          >
                            {client.isActive ? (
                              <>
                                <XCircleIcon className="w-4 h-4 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="w-4 h-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {clientsArray.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No connected wallets found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}