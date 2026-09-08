import { describe, it, expect } from "vitest";
import { formatTokenAmount, rawToUsd, roundUsd, shortAddress } from "@/lib/tokens";

describe("formatTokenAmount", () => {
  it("formats 18-decimal ETH", () => {
    expect(formatTokenAmount(1_500_000_000_000_000_000n, 18)).toBe("1.5");
  });
  it("formats 6-decimal USDC without trailing zeros", () => {
    expect(formatTokenAmount("123450000", 6)).toBe("123.45");
  });
  it("truncates to maxFraction", () => {
    expect(formatTokenAmount(1_234_567_890_123_456_789n, 18, 4)).toBe("1.2345");
  });
  it("handles zero", () => {
    expect(formatTokenAmount(0n, 18)).toBe("0");
  });
});

describe("rawToUsd", () => {
  it("prices 1 ETH at 3000", () => {
    expect(rawToUsd(10n ** 18n, 18, 3000)).toBe(3000);
  });
  it("prices 250.5 USDC at 0.9998", () => {
    expect(roundUsd(rawToUsd(250_500_000n, 6, 0.9998))).toBe(250.45);
  });
  it("does not lose precision on large 18-decimal balances", () => {
    // 123456.789 ETH at $1234.56
    const raw = 123_456_789_000_000_000_000_000n;
    expect(roundUsd(rawToUsd(raw, 18, 1234.56))).toBe(152414813.43);
  });
  it("returns 0 for zero balance or invalid price", () => {
    expect(rawToUsd(0n, 18, 3000)).toBe(0);
    expect(rawToUsd(10n ** 18n, 18, NaN)).toBe(0);
  });
});

describe("shortAddress", () => {
  it("shortens a 0x address", () => {
    expect(shortAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBe("0xA0b8…eB48");
  });
});
