"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDownIcon, SearchIcon } from "lucide-react";
import type { ClientListRow } from "@/actions/client-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientActionsMenu } from "@/components/clients/client-actions-menu";
import { ClientStatusBadge, clientStatus, type ClientStatus } from "@/components/clients/client-status-badge";
import { WalletAddress } from "@/components/clients/wallet-address";
import { getChain } from "@/lib/chains";
import { formatTokenAmount, formatUsd } from "@/lib/tokens";
import { TimeAgo } from "@/components/time-ago";

type StatusFilter = "ALL" | ClientStatus;

export function ClientsTable({ clients, tokenSymbols, initialStatus = "ALL" }: { clients: ClientListRow[]; tokenSymbols: string[]; initialStatus?: StatusFilter }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastSeen", desc: true }]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);

  const rows = useMemo(
    () => (status === "ALL" ? clients : clients.filter((c) => clientStatus(c) === status)),
    [clients, status],
  );

  const columns = useMemo<ColumnDef<ClientListRow>[]>(() => {
    const tokenCols: ColumnDef<ClientListRow>[] = tokenSymbols.map((symbol) => ({
      id: `tok_${symbol}`,
      header: () => <div className="text-right">{symbol}</div>,
      accessorFn: (row) => row.balances.find((b) => b.symbol === symbol)?.usd ?? 0,
      cell: ({ row }) => {
        const b = row.original.balances.find((x) => x.symbol === symbol);
        if (!b || !b.takenAt) return <div className="text-right text-muted-foreground">—</div>;
        return (
          <div className="text-right tabular-nums">
            <div>{formatTokenAmount(b.raw, b.decimals, symbol === "ETH" ? 4 : 2)}</div>
            <div className="text-xs text-muted-foreground">{formatUsd(b.usd)}</div>
          </div>
        );
      },
    }));

    return [
      {
        id: "walletAddress",
        accessorKey: "walletAddress",
        header: "Wallet",
        cell: ({ row }) => (
          <div>
            <WalletAddress address={row.original.walletAddress} chainId={row.original.network} />
            <div className="text-xs text-muted-foreground">{getChain(row.original.network)?.shortName ?? row.original.network ?? "Unknown chain"}</div>
          </div>
        ),
      },
      ...tokenCols,
      {
        id: "lastBalanceUsd",
        accessorFn: (row) => row.lastBalanceUsd ?? -1,
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-mr-3 h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Total USD <ArrowUpDownIcon className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {row.original.lastCheckedAt ? formatUsd(row.original.lastBalanceUsd) : <span className="text-muted-foreground">pending</span>}
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => clientStatus(row),
        header: "Status",
        cell: ({ row }) => <ClientStatusBadge status={clientStatus(row.original)} />,
      },
      {
        id: "location",
        accessorFn: (row) => [row.city, row.country].filter(Boolean).join(", "),
        header: "Location",
        cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{(getValue() as string) || "—"}</span>,
      },
      {
        id: "lastSeen",
        accessorFn: (row) => row.lastSeen.getTime(),
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="-ml-3 h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Last seen <ArrowUpDownIcon className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            <div><TimeAgo date={row.original.lastSeen} /></div>
            <div className="text-xs text-muted-foreground">checked <TimeAgo date={row.original.lastCheckedAt} /></div>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            <ClientActionsMenu client={row.original} />
          </div>
        ),
      },
    ];
  }, [tokenSymbols]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _col, value: string) => {
      const q = value.trim().toLowerCase();
      if (!q) return true;
      const c = row.original;
      return [c.walletAddress, c.city, c.country, c.os, c.browser].some((v) => v?.toLowerCase().includes(q));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search address, location, device…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="seen">Seen</SelectItem>
            <SelectItem value="below">Below threshold</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground sm:ml-auto">
          {table.getFilteredRowModel().rows.length} of {clients.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {clients.length === 0 ? "No wallets have connected yet." : "No clients match the current filter."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/clients/${row.original.id}`)}
                  data-state={row.original.isActive ? undefined : "inactive"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={row.original.isActive ? undefined : "opacity-60"}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
