import { describe, it, expect } from "vitest";
import { evaluate, type TokenBalance } from "@/worker/rules";

const eth = (raw: bigint, usd: number): TokenBalance => ({ tokenId: "eth", symbol: "ETH", decimals: 18, raw, usd });
const usdc = (raw: bigint, usd: number): TokenBalance => ({ tokenId: "usdc", symbol: "USDC", decimals: 6, raw, usd });

const prev = (entries: Record<string, bigint>) => new Map(Object.entries(entries));

describe("threshold > 0", () => {
  it("alerts once when dropping below", () => {
    const r = evaluate({
      current: [eth(10n ** 17n, 300), usdc(100_000_000n, 100)],
      previousRaw: prev({ eth: 10n ** 18n, usdc: 100_000_000n }),
      wasBelowThreshold: false,
      thresholdUsd: 500,
      isFirstRun: false,
    });
    expect(r.totalUsd).toBe(400);
    expect(r.belowThreshold).toBe(true);
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].type).toBe("BELOW_THRESHOLD");
    expect(r.changes.map((c) => c.symbol)).toEqual(["ETH"]);
  });

  it("does not repeat while still below", () => {
    const r = evaluate({
      current: [eth(10n ** 17n, 300)],
      previousRaw: prev({ eth: 10n ** 17n }),
      wasBelowThreshold: true,
      thresholdUsd: 500,
      isFirstRun: false,
    });
    expect(r.alerts).toHaveLength(0);
    expect(r.belowThreshold).toBe(true);
  });

  it("emits BACK_ABOVE when recovering", () => {
    const r = evaluate({
      current: [eth(10n ** 18n, 3000)],
      previousRaw: prev({ eth: 10n ** 17n }),
      wasBelowThreshold: true,
      thresholdUsd: 500,
      isFirstRun: false,
    });
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].type).toBe("BACK_ABOVE");
    expect(r.belowThreshold).toBe(false);
  });

  it("never alerts on first run but records state", () => {
    const r = evaluate({
      current: [eth(0n, 0)],
      previousRaw: prev({}),
      wasBelowThreshold: false,
      thresholdUsd: 500,
      isFirstRun: true,
    });
    expect(r.alerts).toHaveLength(0);
    expect(r.belowThreshold).toBe(true);
    expect(r.changes).toHaveLength(1);
  });

  it("ignores unrelated balance changes while above", () => {
    const r = evaluate({
      current: [eth(2n * 10n ** 18n, 6000)],
      previousRaw: prev({ eth: 10n ** 18n }),
      wasBelowThreshold: false,
      thresholdUsd: 500,
      isFirstRun: false,
    });
    expect(r.alerts).toHaveLength(0);
    expect(r.changes).toHaveLength(1);
  });
});

describe("threshold == 0 (alert on any change)", () => {
  it("emits BALANCE_CHANGED with deltas", () => {
    const r = evaluate({
      current: [eth(15n * 10n ** 17n, 4500), usdc(50_000_000n, 50)],
      previousRaw: prev({ eth: 10n ** 18n, usdc: 100_000_000n }),
      wasBelowThreshold: false,
      thresholdUsd: 0,
      isFirstRun: false,
      previousTotalUsd: 3100,
    });
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].type).toBe("BALANCE_CHANGED");
    expect(r.alerts[0].message).toContain("ETH +0.5");
    expect(r.alerts[0].message).toContain("USDC -50");
    expect(r.alerts[0].message).toContain("total $4,550.00 (ETH $3,000.00, was $3,100.00)");
    expect(r.alerts[0].payload.prices).toEqual({ ETH: 3000, USDC: 1 });
    expect(r.belowThreshold).toBe(false);
  });

  it("stays silent when nothing changed", () => {
    const r = evaluate({
      current: [eth(10n ** 18n, 3000)],
      previousRaw: prev({ eth: 10n ** 18n }),
      wasBelowThreshold: false,
      thresholdUsd: 0,
      isFirstRun: false,
    });
    expect(r.alerts).toHaveLength(0);
  });

  it("clears a stale belowThreshold flag", () => {
    const r = evaluate({
      current: [eth(10n ** 18n, 3000)],
      previousRaw: prev({ eth: 10n ** 18n }),
      wasBelowThreshold: true,
      thresholdUsd: 0,
      isFirstRun: false,
    });
    expect(r.belowThreshold).toBe(false);
  });
});
