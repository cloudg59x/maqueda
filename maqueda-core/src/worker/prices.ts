/**
 * CoinGecko price feed with a two-level cache:
 *   1. in-memory, 60 s TTL: at most one request per minute;
 *   2. persisted in the Setting table (key "price_cache"): a fresh worker process is not blind
 *      when CoinGecko is slow right after startup.
 * One retry on failure. If everything fails, the last known prices are served with `stale: true`.
 */

export interface PriceResult {
  prices: Map<string, number>; // coingeckoId -> USD
  stale: boolean; // served from cache because this tick's fetch failed
  fetchedAt: number | null; // when the served prices were fetched, null if none
  error?: string;
}

/** Minimal persistence hook so this module stays free of Prisma in tests. */
export interface PriceStore {
  load(): Promise<{ prices: Record<string, number>; fetchedAt: number } | null>;
  save(data: { prices: Record<string, number>; fetchedAt: number }): Promise<void>;
}

interface Cache {
  prices: Map<string, number>;
  fetchedAt: number;
  ids: string;
}

const CACHE_TTL_MS = 60_000;
const TIMEOUT_MS = 15_000;
const RETRIES = 1;
let cache: Cache | null = null;
let storeLoaded = false;

export function resetPriceCache() {
  cache = null;
  storeLoaded = false;
}

export async function getPrices(
  coingeckoIds: string[],
  opts: { fetchImpl?: typeof fetch; now?: () => number; store?: PriceStore } = {},
): Promise<PriceResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const ids = Array.from(new Set(coingeckoIds)).sort().join(",");
  if (!ids) return { prices: new Map(), stale: false, fetchedAt: null };

  // Warm the in-memory cache from the store once per process.
  if (!cache && opts.store && !storeLoaded) {
    storeLoaded = true;
    const saved = await opts.store.load().catch(() => null);
    if (saved && Object.keys(saved.prices).length > 0) {
      cache = { prices: new Map(Object.entries(saved.prices)), fetchedAt: saved.fetchedAt, ids: "" };
    }
  }

  if (cache && cache.ids === ids && now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { prices: cache.prices, stale: false, fetchedAt: cache.fetchedAt };
  }

  const base = process.env.COINGECKO_BASE_URL ?? "https://api.coingecko.com/api/v3";
  const url = `${base}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;

  let lastError = "";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, { usd?: number }>;
      const prices = new Map<string, number>();
      for (const id of ids.split(",")) {
        const usd = body[id]?.usd;
        if (typeof usd === "number" && Number.isFinite(usd)) prices.set(id, usd);
      }
      if (prices.size === 0) throw new Error("CoinGecko returned no prices");
      const fetchedAt = now();
      cache = { prices, fetchedAt, ids };
      if (opts.store) await opts.store.save({ prices: Object.fromEntries(prices), fetchedAt }).catch(() => undefined);
      return { prices, stale: false, fetchedAt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  // All attempts failed: serve whatever we have, even if it was fetched for a different id set.
  if (cache && cache.prices.size > 0) {
    return { prices: cache.prices, stale: true, fetchedAt: cache.fetchedAt, error: lastError };
  }
  return { prices: new Map(), stale: true, fetchedAt: null, error: lastError };
}
