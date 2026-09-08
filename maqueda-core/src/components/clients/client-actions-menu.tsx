"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BanIcon, CheckCircle2Icon, EyeIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteClient, setClientActive } from "@/actions/client-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortAddress } from "@/lib/tokens";

interface Props {
  client: { id: string; walletAddress: string; isActive: boolean };
  /** "menu" = kebab in table rows; "buttons" = inline buttons on the detail page. */
  variant?: "menu" | "buttons";
  showView?: boolean;
}

type Pending = null | "deactivate" | "activate" | "delete";

export function ClientActionsMenu({ client, variant = "menu", showView = true }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();

  function run(kind: Exclude<Pending, null>) {
    startTransition(async () => {
      const res = kind === "delete" ? await deleteClient(client.id) : await setClientActive(client.id, kind === "activate");
      if (res.success) {
        toast.success(
          kind === "delete" ? "Client deleted" : kind === "activate" ? "Client activated" : "Client deactivated",
          { description: shortAddress(client.walletAddress) },
        );
        setConfirm(null);
        if (kind === "delete") router.push("/admin/clients");
        else router.refresh();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  }

  const toggleLabel = client.isActive ? "Deactivate" : "Activate";
  const ToggleIcon = client.isActive ? BanIcon : CheckCircle2Icon;
  const toggleKind: Exclude<Pending, null> = client.isActive ? "deactivate" : "activate";

  return (
    <>
      {variant === "menu" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()} aria-label="Actions">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {showView && (
              <DropdownMenuItem onSelect={() => router.push(`/admin/clients/${client.id}`)}>
                <EyeIcon /> View details
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => (client.isActive ? setConfirm("deactivate") : run("activate"))}>
              <ToggleIcon /> {toggleLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm("delete")}>
              <Trash2Icon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant={client.isActive ? "outline" : "default"}
            size="sm"
            disabled={isPending}
            onClick={() => (client.isActive ? setConfirm("deactivate") : run("activate"))}
          >
            <ToggleIcon /> {toggleLabel}
          </Button>
          <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setConfirm("delete")}>
            <Trash2Icon /> Delete
          </Button>
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? "Delete this client?" : "Deactivate this client?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete" ? (
                <>
                  <span className="font-mono">{client.walletAddress}</span> and all its snapshots, alerts and audit entries will be removed. This cannot be undone.
                </>
              ) : (
                <>
                  <span className="font-mono">{client.walletAddress}</span> will stop being monitored and will be flagged as deactivated. You can reactivate it later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className={confirm === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              onClick={(e) => {
                e.preventDefault();
                run(confirm === "delete" ? "delete" : toggleKind);
              }}
            >
              {isPending ? "Working…" : confirm === "delete" ? "Delete" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
