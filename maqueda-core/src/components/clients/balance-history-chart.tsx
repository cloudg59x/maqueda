"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { HistoryPoint } from "@/actions/client-actions";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatUsd } from "@/lib/tokens";

const config = {
  totalUsd: { label: "Total USD", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function BalanceHistoryChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Not enough history yet. The chart fills in as balances change.
      </div>
    );
  }
  const data = points.map((p) => ({ ...p, t: new Date(p.takenAt).getTime() }));
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <AreaChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-totalUsd)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-totalUsd)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeOpacity={0.2} />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tickLine={false}
          axisLine={false}
          minTickGap={48}
          tickFormatter={(v: number) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        />
        <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatUsd(v)} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_l, payload) => {
                const t = payload?.[0]?.payload?.t as number | undefined;
                return t ? new Date(t).toLocaleString("en-GB") : "";
              }}
              formatter={(value) => formatUsd(Number(value))}
            />
          }
        />
        <Area dataKey="totalUsd" type="stepAfter" stroke="var(--color-totalUsd)" fill="url(#fillTotal)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
