import { describe, it, expect, beforeEach } from "vitest";
import { getPrices, resetPriceCache, type PriceStore } from "@/worker/prices";

const okFetch = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
const failFetch = (async () => {
  throw new Error("network down");
}) as unknown as typeof fetch;

function memoryStore(initial: { prices: Record<string, number>; fetchedAt: number } | null = null): PriceStore & { saved: unknown } {
  let data = initial;
  return {
    saved: null,
    async load() {
      return data;
    },
    async save(d) {
      data = d;
      this.saved = d;
    },
  };
}

describe("getPrices", () => {
  beforeEach(() => resetPriceCache());

  it("fetches and parses prices", async () => {
    const r = await getPrices(["ethereum", "usd-coin"], { fetchImpl: okFetch({ ethereum: { usd: 3000 }, "usd-coin": { usd: 1 } }) });
    expect(r.stale).toBe(false);
    expect(r.prices.get("ethereum")).toBe(3000);
  });

  it("serves from cache within TTL without refetching", async () => {
    let calls = 0;
    const counting = (async () => {
      calls++;
      return new Response(JSON.stringify({ ethereum: { usd: 1 } }));
    }) as unknown as typeof fetch;
    let t = 1000;
    await getPrices(["ethereum"], { fetchImpl: counting, now: () => t });
    t += 30_000;
    await getPrices(["ethereum"], { fetchImpl: counting, now: () => t });
    expect(calls).toBe(1);
    t += 40_000;
    await getPrices(["ethereum"], { fetchImpl: counting, now: () => t });
    expect(calls).toBe(2);
  });

  it("retries once before giving up", async () => {
    let calls = 0;
    const flaky = (async () => {
      calls++;
      if (calls === 1) throw new Error("timeout");
      return new Response(JSON.stringify({ ethereum: { usd: 42 } }));
    }) as unknown as typeof fetch;
    const r = await getPrices(["ethereum"], { fetchImpl: flaky });
    expect(calls).toBe(2);
    expect(r.stale).toBe(false);
    expect(r.prices.get("ethereum")).toBe(42);
  });

  it("falls back to last known prices on failure and flags stale", async () => {
    await getPrices(["ethereum"], { fetchImpl: okFetch({ ethereum: { usd: 2500 } }), now: () => 0 });
    const r = await getPrices(["ethereum"], { fetchImpl: failFetch, now: () => 120_000 });
    expect(r.stale).toBe(true);
    expect(r.prices.get("ethereum")).toBe(2500);
    expect(r.fetchedAt).toBe(0);
    expect(r.error).toContain("network down");
  });

  it("returns empty + stale when there is no fallback", async () => {
    const r = await getPrices(["ethereum"], { fetchImpl: failFetch });
    expect(r.stale).toBe(true);
    expect(r.prices.size).toBe(0);
    expect(r.fetchedAt).toBeNull();
  });

  it("saves successful fetches to the store", async () => {
    const store = memoryStore();
    await getPrices(["ethereum"], { fetchImpl: okFetch({ ethereum: { usd: 10 } }), now: () => 5, store });
    expect(store.saved).toEqual({ prices: { ethereum: 10 }, fetchedAt: 5 });
  });

  it("warms from the store so a fresh process survives a failing feed", async () => {
    const store = memoryStore({ prices: { ethereum: 1234 }, fetchedAt: 0 });
    const r = await getPrices(["ethereum"], { fetchImpl: failFetch, now: () => 999_999, store });
    expect(r.stale).toBe(true);
    expect(r.prices.get("ethereum")).toBe(1234);
  });
});
