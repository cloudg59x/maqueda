import type { AlertType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<AlertType, { label: string; className: string }> = {
  BELOW_THRESHOLD: { label: "Below threshold", className: "border-destructive/50 bg-destructive/15 text-destructive" },
  BACK_ABOVE: { label: "Back above", className: "border-success/50 bg-success/15 text-success" },
  BALANCE_CHANGED: { label: "Balance changed", className: "border-chart-1/50 bg-chart-1/15 text-chart-1" },
  WORKER_ERROR: { label: "Worker error", className: "border-warning/50 bg-warning/15 text-warning" },
};

export function AlertTypeBadge({ type, className }: { type: AlertType; className?: string }) {
  const s = STYLES[type] ?? { label: type, className: "" };
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", s.className, className)}>
      {s.label}
    </Badge>
  );
}
