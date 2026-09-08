/**
 * Fetch native + ERC-20 balances for many wallets in as few RPC calls as possible.
 * ERC-20 reads go through viem `multicall` (Multicall3 exists on mainnet and Sepolia).
 * Native balances use `getBalance`, batched by viem's HTTP transport.
 */
import { createPublicClient, erc20Abi, http, type Address, type PublicClient } from "viem";
import type { ChainInfo } from "@/lib/chains";

export interface WalletTarget {
  clientId: string;
  address: Address;
}

export interface TokenTarget {
  tokenId: string;
  address: Address | null; // null = native coin
}

/** clientId -> tokenId -> raw balance */
export type BalanceMatrix = Map<string, Map<string, bigint>>;

export function createRpcClient(chain: ChainInfo, rpcUrl = process.env.RPC_URL): PublicClient {
  if (!rpcUrl) throw new Error("RPC_URL is not set");
  return createPublicClient({
    chain: chain.viemChain,
    transport: http(rpcUrl, { batch: true, timeout: 15_000, retryCount: 2 }),
  });
}

export async function fetchBalances(
  client: Pick<PublicClient, "getBalance" | "multicall">,
  wallets: WalletTarget[],
  tokens: TokenTarget[],
): Promise<BalanceMatrix> {
  const matrix: BalanceMatrix = new Map();
  for (const w of wallets) matrix.set(w.clientId, new Map());
  if (wallets.length === 0 || tokens.length === 0) return matrix;

  const nativeTokens = tokens.filter((t) => t.address === null);
  const erc20Tokens = tokens.filter((t): t is TokenTarget & { address: Address } => t.address !== null);

  if (nativeTokens.length > 0) {
    const natives = await Promise.all(wallets.map((w) => client.getBalance({ address: w.address })));
    wallets.forEach((w, i) => {
      for (const t of nativeTokens) matrix.get(w.clientId)!.set(t.tokenId, natives[i]);
    });
  }

  if (erc20Tokens.length > 0) {
    const contracts = [];
    for (const w of wallets) {
      for (const t of erc20Tokens) {
        contracts.push({ address: t.address, abi: erc20Abi, functionName: "balanceOf" as const, args: [w.address] as const });
      }
    }
    const results = await client.multicall({ contracts, allowFailure: true });
    let i = 0;
    for (const w of wallets) {
      for (const t of erc20Tokens) {
        const r = results[i++];
        if (r.status === "success") {
          matrix.get(w.clientId)!.set(t.tokenId, r.result as bigint);
        }
        // On failure the token is simply absent for this wallet this tick; the caller keeps the last snapshot.
      }
    }
  }

  return matrix;
}
