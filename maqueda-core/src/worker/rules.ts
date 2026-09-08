/**
 * Pure alert rule engine. No I/O so it can be unit tested exhaustively.
 * See docs/worker.md for the rules in prose.
 */
import type { AlertType } from "@prisma/client";

export interface TokenBalance {
  tokenId: string;
  symbol: string;
  decimals: number;
  raw: bigint;
  usd: number;
}

export interface EvaluateInput {
  /** Balances fetched this tick, one per enabled token. */
  current: TokenBalance[];
  /** Raw balances from the latest stored snapshot per token. Missing key = never seen. */
  previousRaw: Map<string, bigint>;
  /** Client.belowThreshold before this tick. */
  wasBelowThreshold: boolean;
  /** 0 disables the threshold and alerts on every change instead. */
  thresholdUsd: number;
  /** True if the client has never been snapshotted: record, never alert. */
  isFirstRun: boolean;
  /** Client.lastBalanceUsd before this tick, to explain totals that move with prices. */
  previousTotalUsd?: number | null;
}

export interface AlertDraft {
  type: AlertType;
  message: string;
  payload: Record<string, unknown>;
}

export interface TokenChange {
  tokenId: string;
  symbol: string;
  decimals: number;
  previousRaw: bigint;
  currentRaw: bigint;
}

export interface EvaluateResult {
  totalUsd: number;
  changes: TokenChange[];
  alerts: AlertDraft[];
  belowThreshold: boolean;
}

export function evaluate(input: EvaluateInput): EvaluateResult {
  const totalUsd = round2(input.current.reduce((sum, b) => sum + b.usd, 0));

  const changes: TokenChange[] = [];
  for (const b of input.current) {
    const prev = input.previousRaw.get(b.tokenId);
    if (prev === undefined || prev !== b.raw) {
      changes.push({
        tokenId: b.tokenId,
        symbol: b.symbol,
        decimals: b.decimals,
        previousRaw: prev ?? 0n,
        currentRaw: b.raw,
      });
    }
  }

  const alerts: AlertDraft[] = [];
  let belowThreshold = input.wasBelowThreshold;

  if (input.thresholdUsd > 0) {
    const isBelow = totalUsd < input.thresholdUsd;
    belowThreshold = isBelow;
    if (!input.isFirstRun) {
      if (isBelow && !input.wasBelowThreshold) {
        alerts.push({
          type: "BELOW_THRESHOLD",
          message: `Balance dropped below $${fmt(input.thresholdUsd)} (now $${fmt(totalUsd)})`,
          payload: { totalUsd, thresholdUsd: input.thresholdUsd, changes: serializeChanges(changes) },
        });
      } else if (!isBelow && input.wasBelowThreshold) {
        alerts.push({
          type: "BACK_ABOVE",
          message: `Balance back above $${fmt(input.thresholdUsd)} (now $${fmt(totalUsd)})`,
          payload: { totalUsd, thresholdUsd: input.thresholdUsd, changes: serializeChanges(changes) },
        });
      }
    }
  } else {
    belowThreshold = false;
    if (!input.isFirstRun && changes.length > 0) {
      const parts = changes.map((c) => {
        const sign = c.currentRaw >= c.previousRaw ? "+" : "-";
        const delta = c.currentRaw >= c.previousRaw ? c.currentRaw - c.previousRaw : c.previousRaw - c.currentRaw;
        return `${c.symbol} ${sign}${formatRaw(delta, c.decimals)}`;
      });
      alerts.push({
        type: "BALANCE_CHANGED",
        message: `Balance changed: ${parts.join(", ")} · ${describeTotal(totalUsd, input.previousTotalUsd, input.current)}`,
        payload: { totalUsd, previousTotalUsd: input.previousTotalUsd ?? null, changes: serializeChanges(changes), prices: pricesOf(input.current) },
      });
    }
  }

  return { totalUsd, changes, alerts, belowThreshold };
}

/** "total $X (was $Y, ETH $Z)" so a total that moves with the market is not read as a wallet change. */
function describeTotal(totalUsd: number, previousTotalUsd: number | null | undefined, current: TokenBalance[]): string {
  const prices = pricesOf(current);
  const priceNote = Object.entries(prices)
    .filter(([symbol]) => symbol === "ETH")
    .map(([symbol, price]) => `${symbol} $${fmt(price)}`)
    .join(", ");
  const was = previousTotalUsd !== null && previousTotalUsd !== undefined ? `, was $${fmt(previousTotalUsd)}` : "";
  return `total $${fmt(totalUsd)} (${[priceNote, was.replace(/^, /, "")].filter(Boolean).join(", ")})`;
}

/** Implied USD price per token symbol, derived from raw and usd of this tick. */
function pricesOf(current: TokenBalance[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of current) {
    if (b.raw === 0n) continue;
    const amount = Number(b.raw) / 10 ** b.decimals;
    if (amount > 0) out[b.symbol] = Math.round((b.usd / amount) * 100) / 100;
  }
  return out;
}

function serializeChanges(changes: TokenChange[]) {
  return changes.map((c) => ({
    tokenId: c.tokenId,
    symbol: c.symbol,
    previous: c.previousRaw.toString(),
    current: c.currentRaw.toString(),
    previousFormatted: formatRaw(c.previousRaw, c.decimals),
    currentFormatted: formatRaw(c.currentRaw, c.decimals),
  }));
}

function formatRaw(raw: bigint, decimals: number): string {
  const s = raw.toString().padStart(decimals + 1, "0");
  const int = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, 6).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
