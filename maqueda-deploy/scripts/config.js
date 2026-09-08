// Maqueda dApp configuration. Edit this file per deployment; script.js never needs changes.
// Values can be overridden for a single visit with URL parameters (useful for testing):
//   ?chain=sepolia | mainnet     which chain the payment flow targets
//   ?api=https://admin.example   admin API base URL
window.MAQUEDA_CONFIG = {
  // Admin API (maqueda-core). Must list this page's origin in its DAPP_ORIGINS.
  API_BASE_URL: "http://localhost:3000",

  // "mainnet" for real payments, "sepolia" to test with faucet funds (same wallet, same address).
  CHAIN: "sepolia",

  // Supported chains. Token contract addresses verified on-chain on 2026-09-07.
  CHAINS: {
    mainnet: {
      chainId: "0x1",
      name: "Ethereum",
      nativeSymbol: "ETH",
      explorerUrl: "https://etherscan.io",
      isTestnet: false,
      tokens: {
        usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, coingeckoId: "usd-coin" },
        usdt: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, coingeckoId: "tether" },
      },
    },
    sepolia: {
      chainId: "0xaa36a7",
      name: "Ethereum Sepolia",
      nativeSymbol: "ETH",
      explorerUrl: "https://sepolia.etherscan.io",
      isTestnet: true,
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
      tokens: {
        // Circle's official Sepolia USDC. Faucet: https://faucet.circle.com
        usdc: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, coingeckoId: "usd-coin" },
        // No official USDT on Sepolia: deploy a mock ERC-20 and put its address here to test.
        usdt: { address: null, decimals: 6, coingeckoId: "tether" },
      },
    },
  },

  // Fallback USD prices used for the preview when CoinGecko is unreachable.
  FALLBACK_PRICES_USD: { eth: 2500, usdc: 1, usdt: 1 },

  // Milliseconds to wait for wallet extensions to announce themselves (EIP-6963) before deciding.
  PROVIDER_DISCOVERY_MS: 2000,
};
