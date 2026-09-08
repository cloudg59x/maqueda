/**
 * Idempotent seed: monitored tokens, default settings, worker state row, first admin user.
 * Run with `npm run db:seed` (also runs automatically after `npm run db:reset`).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getAddress } from "viem";

const prisma = new PrismaClient();

// Verified on-chain on 2026-09-07 via symbol()/decimals() calls.
const TOKENS = [
  // Ethereum Mainnet
  { chainId: "0x1", symbol: "ETH", name: "Ether", address: null, decimals: 18, coingeckoId: "ethereum", enabled: true },
  { chainId: "0x1", symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, coingeckoId: "usd-coin", enabled: true },
  { chainId: "0x1", symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, coingeckoId: "tether", enabled: true },
  // Ethereum Sepolia (testnet)
  { chainId: "0xaa36a7", symbol: "ETH", name: "Sepolia Ether", address: null, decimals: 18, coingeckoId: "ethereum", enabled: true },
  { chainId: "0xaa36a7", symbol: "USDC", name: "USD Coin (Circle testnet)", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, coingeckoId: "usd-coin", enabled: true },
  // No official USDT on Sepolia. Set an address (e.g. a mock ERC-20 you deploy) and enable it from Settings.
  { chainId: "0xaa36a7", symbol: "USDT", name: "Tether USD (no official testnet contract)", address: null, decimals: 6, coingeckoId: "tether", enabled: false },
];

const SETTINGS: Record<string, string> = {
  threshold_usd: "0",
  poll_interval_sec: "15",
  telegram_bot_token: "",
  telegram_chat_id: "",
};

async function main() {
  for (const token of TOKENS) {
    const address = token.address ? getAddress(token.address) : null;
    await prisma.monitoredToken.upsert({
      where: { chainId_symbol: { chainId: token.chainId, symbol: token.symbol } },
      update: { name: token.name, address, decimals: token.decimals, coingeckoId: token.coingeckoId },
      create: { ...token, address },
    });
  }
  console.log(`[seed] ${TOKENS.length} monitored tokens upserted`);

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`[seed] ${Object.keys(SETTINGS).length} settings ensured`);

  await prisma.workerState.upsert({ where: { id: "monitor" }, update: {}, create: { id: "monitor" } });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "AdminPass123!";
  const existing = await prisma.user.count();
  if (existing === 0) {
    await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 10), name: "Admin", role: "ADMIN" },
    });
    console.log(`[seed] admin user created: ${email}`);
  } else {
    console.log(`[seed] users already exist, admin not created`);
  }
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
