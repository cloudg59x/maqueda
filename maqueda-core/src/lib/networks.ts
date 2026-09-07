interface NetworkInfo {
  name: string;
  symbol: string;
}

const NETWORKS: Record<string, NetworkInfo> = {
  "0x1": { name: "Ethereum Mainnet", symbol: "ETH" },
  "0x3": { name: "Ethereum Ropsten", symbol: "ETH" },
  "0x4": { name: "Ethereum Rinkeby", symbol: "ETH" },
  "0x5": { name: "Ethereum Goerli", symbol: "ETH" },
  "0x2a": { name: "Ethereum Kovan", symbol: "ETH" },
  "0x89": { name: "Polygon Mainnet", symbol: "MATIC" },
  "0x13881": { name: "Polygon Mumbai", symbol: "MATIC" },
  "0x38": { name: "Binance Smart Chain", symbol: "BNB" },
  "0x61": { name: "Binance Smart Chain Testnet", symbol: "BNB" },
  "0xa86a": { name: "Avalanche Mainnet", symbol: "AVAX" },
  "0xa869": { name: "Avalanche Fuji Testnet", symbol: "AVAX" },
  "0xfa": { name: "Fantom Opera", symbol: "FTM" },
  "0xfa2": { name: "Fantom Testnet", symbol: "FTM" },
};

export function getNetworkInfo(chainId: string): NetworkInfo | null {
  return NETWORKS[chainId] || null;
}

export function getNetworkName(chainId: string): string {
  return NETWORKS[chainId]?.name || `Unknown Network (${chainId})`;
}