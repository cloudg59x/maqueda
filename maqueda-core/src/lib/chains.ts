import { mainnet, sepolia, type Chain } from "viem/chains";

export interface ChainInfo {
  id: string; // hex chain id as reported by wallets
  name: string;
  shortName: string;
  nativeSymbol: string;
  explorerUrl: string;
  viemChain: Chain;
  isTestnet: boolean;
}

export const CHAINS: Record<string, ChainInfo> = {
  "0x1": {
    id: "0x1",
    name: "Ethereum Mainnet",
    shortName: "Mainnet",
    nativeSymbol: "ETH",
    explorerUrl: "https://etherscan.io",
    viemChain: mainnet,
    isTestnet: false,
  },
  "0xaa36a7": {
    id: "0xaa36a7",
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    nativeSymbol: "ETH",
    explorerUrl: "https://sepolia.etherscan.io",
    viemChain: sepolia,
    isTestnet: true,
  },
};

export function normalizeChainId(chainId: string | number | null | undefined): string | null {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === "number") return `0x${chainId.toString(16)}`;
  const trimmed = chainId.trim().toLowerCase();
  if (trimmed.startsWith("0x")) return trimmed;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) ? `0x${asNumber.toString(16)}` : null;
}

export function getChain(chainId: string | null | undefined): ChainInfo | null {
  const normalized = normalizeChainId(chainId);
  return normalized ? CHAINS[normalized] ?? null : null;
}

export function getChainName(chainId: string | null | undefined): string {
  const chain = getChain(chainId);
  if (chain) return chain.name;
  return chainId ? `Unknown (${chainId})` : "Unknown";
}

export function explorerAddressUrl(chainId: string | null | undefined, address: string): string | null {
  const chain = getChain(chainId);
  return chain ? `${chain.explorerUrl}/address/${address}` : null;
}

/** Chain the worker monitors, from CHAIN_ID env. Throws early if misconfigured. */
export function getMonitoredChain(): ChainInfo {
  const chain = getChain(process.env.CHAIN_ID);
  if (!chain) {
    throw new Error(
      `CHAIN_ID "${process.env.CHAIN_ID}" is not supported. Use one of: ${Object.keys(CHAINS).join(", ")}`,
    );
  }
  return chain;
}
