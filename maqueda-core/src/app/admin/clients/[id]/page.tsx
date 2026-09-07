import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClientById } from "@/actions/client-actions";
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
  InfoIcon
} from "lucide-react";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const { success, data: client } = await getClientById(params.id);
  
  if (!success || !client) {
    notFound();
  }

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
            <h2 className="text-2xl font-bold tracking-tight">Client Details</h2>
            <p className="text-muted-foreground">
              Detailed information about connected wallet client
            </p>
          </div>
          <div>
            <Badge variant={client.isActive ? 'default' : 'secondary'}>
              <ActivityIcon className="w-3 h-3 mr-1" />
              {client.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Client Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>
              Basic information about this connected wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <WifiIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Wallet Address:</span>
                </div>
                <div className="font-mono text-sm bg-muted p-2 rounded">
                  {client.walletAddress}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GlobeIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Network:</span>
                </div>
                <div>
                  {client.network ? getNetworkName(client.network) : 'Unknown'}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Location:</span>
                </div>
                <div>
                  {client.city ? `${client.city}, ${client.region}, ${client.country}` : 
                   client.country ? `${client.country}` : 'Unknown'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {client.latitude && client.longitude ? 
                    `(${client.latitude}, ${client.longitude})` : ''}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">First Seen:</span>
                </div>
                <div>
                  {new Date(client.firstSeen).toLocaleString()}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Last Seen:</span>
                </div>
                <div>
                  {new Date(client.lastSeen).toLocaleString()}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MonitorIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Device:</span>
                </div>
                <div className="flex items-center gap-2">
                  {getDeviceTypeIcon(client.deviceType || '')}
                  <span>{client.os} / {client.browser}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <InfoIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">User Agent:</span>
                </div>
                <div className="text-sm bg-muted p-2 rounded max-h-20 overflow-y-auto">
                  {client.userAgent || 'Not available'}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <InfoIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Screen Info:</span>
                </div>
                <div>
                  {client.screenInfo || 'Not available'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Card */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>
              Activity history for this client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.auditLogs && client.auditLogs.length > 0 ? (
                  client.auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {log.ipAddress || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {log.details ? JSON.parse(log.details).network || 'N/A' : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No audit logs found for this client
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}