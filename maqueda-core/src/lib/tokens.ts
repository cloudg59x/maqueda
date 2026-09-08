import { formatUnits } from "viem";

/**
 * Convert a raw uint256 balance to a human amount string (no rounding loss).
 * Uses viem's formatUnits so 18-decimal values never go through a JS float.
 */
export function formatTokenAmount(raw: bigint | string, decimals: number, maxFraction = 6): string {
  const value = typeof raw === "string" ? BigInt(raw) : raw;
  const full = formatUnits(value, decimals);
  const [intPart, fracPart = ""] = full.split(".");
  const frac = fracPart.slice(0, maxFraction).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

/**
 * USD value of a raw balance at a given price, rounded to cents.
 * Works in integer math scaled by 1e6 for the price to avoid float drift
 * on large 18-decimal balances.
 */
export function rawToUsd(raw: bigint | string, decimals: number, priceUsd: number): number {
  const value = typeof raw === "string" ? BigInt(raw) : raw;
  if (value === 0n || !Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
  const priceMicro = BigInt(Math.round(priceUsd * 1_000_000));
  const scaled = (value * priceMicro) / 10n ** BigInt(decimals); // micro-dollars
  return Number(scaled) / 1_000_000;
}

export function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address || address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
