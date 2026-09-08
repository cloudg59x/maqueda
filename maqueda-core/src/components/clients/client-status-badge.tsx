import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status ladder for a wallet. "seen" only means the dApp reported the address after the connect popup:
 * nothing is enforceable until the client enrolls on-chain (allowance to the contract, future iteration).
 */
export type ClientStatus = "seen" | "below" | "inactive";

export function clientStatus(c: { isActive: boolean; belowThreshold: boolean }): ClientStatus {
  if (!c.isActive) return "inactive";
  return c.belowThreshold ? "below" : "seen";
}

export const CLIENT_STATUS_INFO: Record<ClientStatus, { label: string; description: string; className: string }> = {
  seen: {
    label: "Seen",
    description: "Opened the dApp and shared its address. Not enrolled: nothing can be enforced yet.",
    className: "border-border bg-muted/60 text-foreground/80",
  },
  below: {
    label: "Below threshold",
    description: "Total USD value dropped below the configured threshold.",
    className: "border-destructive/50 bg-destructive/15 text-destructive",
  },
  inactive: {
    label: "Deactivated",
    description: "Excluded by an admin. Not monitored.",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function ClientStatusBadge({ status, className }: { status: ClientStatus; className?: string }) {
  const s = CLIENT_STATUS_INFO[status];
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", s.className, className)} title={s.description}>
      {s.label}
    </Badge>
  );
}
