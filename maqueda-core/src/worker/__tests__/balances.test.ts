import { describe, it, expect } from "vitest";
import { fetchBalances } from "@/worker/balances";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

describe("fetchBalances", () => {
  it("fills native and ERC-20 balances with one multicall", async () => {
    let multicallCalls = 0;
    const client = {
      getBalance: async ({ address }: { address: string }) => (address === A ? 10n : 20n),
      multicall: async ({ contracts }: { contracts: unknown[] }) => {
        multicallCalls++;
        expect(contracts).toHaveLength(2);
        return [
          { status: "success", result: 1_000_000n },
          { status: "failure", error: new Error("boom") },
        ];
      },
    };
    const m = await fetchBalances(client as never, [
      { clientId: "a", address: A },
      { clientId: "b", address: B },
    ], [
      { tokenId: "eth", address: null },
      { tokenId: "usdc", address: USDC },
    ]);
    expect(multicallCalls).toBe(1);
    expect(m.get("a")?.get("eth")).toBe(10n);
    expect(m.get("b")?.get("eth")).toBe(20n);
    expect(m.get("a")?.get("usdc")).toBe(1_000_000n);
    expect(m.get("b")?.has("usdc")).toBe(false);
  });

  it("returns empty maps with no wallets", async () => {
    const client = { getBalance: async () => 0n, multicall: async () => [] };
    const m = await fetchBalances(client as never, [], [{ tokenId: "eth", address: null }]);
    expect(m.size).toBe(0);
  });
});
