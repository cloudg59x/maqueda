"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { updateMonitoredToken, type MonitoredTokenRow } from "@/actions/settings-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getChainName } from "@/lib/chains";
import { shortAddress } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function TokensTable({ tokens }: { tokens: MonitoredTokenRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<MonitoredTokenRow | null>(null);
  const [address, setAddress] = useState("");

  function toggle(t: MonitoredTokenRow, enabled: boolean) {
    startTransition(async () => {
      const res = await updateMonitoredToken({ id: t.id, enabled });
      if (res.success) {
        toast.success(`${t.symbol} on ${getChainName(t.chainId)} ${enabled ? "enabled" : "disabled"}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function saveAddress() {
    if (!editing) return;
    startTransition(async () => {
      const res = await updateMonitoredToken({ id: editing.id, enabled: editing.enabled, address: address.trim() || null });
      if (res.success) {
        toast.success(`${editing.symbol} address updated`);
        setEditing(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const chains = Array.from(new Set(tokens.map((t) => t.chainId)));

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chain</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Decimals</TableHead>
              <TableHead>CoinGecko id</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chains.map((chainId) =>
              tokens
                .filter((t) => t.chainId === chainId)
                .map((t, i) => (
                  <TableRow key={t.id} className={cn(!t.isCurrentChain && "text-muted-foreground")}>
                    <TableCell className="whitespace-nowrap">
                      {i === 0 && (
                        <span className="inline-flex items-center gap-2">
                          {getChainName(chainId)}
                          {t.isCurrentChain && <Badge variant="secondary">current</Badge>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.symbol}</div>
                      <div className="text-xs text-muted-foreground">{t.name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        {t.address ? shortAddress(t.address, 8, 6) : <span className="italic text-muted-foreground">{t.symbol === "ETH" ? "native" : "not set"}</span>}
                        {t.symbol !== "ETH" && (
                          <Button variant="ghost" size="icon" className="size-6" onClick={() => { setEditing(t); setAddress(t.address ?? ""); }} aria-label="Edit contract address">
                            <PencilIcon className="size-3" />
                          </Button>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{t.decimals}</TableCell>
                    <TableCell className="font-mono text-xs">{t.coingeckoId}</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={t.enabled} disabled={isPending} onCheckedChange={(v) => toggle(t, v)} aria-label={`Toggle ${t.symbol}`} />
                    </TableCell>
                  </TableRow>
                )),
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.symbol} contract on {editing ? getChainName(editing.chainId) : ""}</DialogTitle>
            <DialogDescription>ERC-20 contract address the worker calls <code>balanceOf</code> on. Leave empty to unset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="token-address">Address</Label>
            <Input id="token-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" className="font-mono" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={saveAddress} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
