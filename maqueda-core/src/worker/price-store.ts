import { prisma } from "@/lib/db";
import type { PriceStore } from "@/worker/prices";

const KEY = "price_cache";

/** Persists the last successful CoinGecko response in the Setting table. */
export const prismaPriceStore: PriceStore = {
  async load() {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    if (!row) return null;
    const parsed = JSON.parse(row.value) as { prices: Record<string, number>; fetchedAt: number };
    return parsed && typeof parsed.fetchedAt === "number" && parsed.prices ? parsed : null;
  },
  async save(data) {
    const value = JSON.stringify(data);
    await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  },
};
