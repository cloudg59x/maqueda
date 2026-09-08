import type { AuditRow } from "@/actions/client-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No audit entries.</TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(r.timestamp)}</TableCell>
                <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                <TableCell className="text-sm">{r.user?.email ?? r.actor}{r.ipAddress ? <span className="ml-1 text-xs text-muted-foreground">({r.ipAddress})</span> : null}</TableCell>
                <TableCell className="max-w-md">
                  {r.details ? <code className="block truncate font-mono text-xs text-muted-foreground" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</code> : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
