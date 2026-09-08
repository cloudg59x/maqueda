/**
 * Balance monitor worker. Run with `npm run worker` (or `npm run dev:worker` for watch mode).
 *
 * Every `poll_interval_sec` (from Settings):
 *   settings -> active clients + enabled tokens -> prices -> balances (multicall)
 *   -> evaluate rules per client -> persist snapshots/alerts -> notify -> heartbeat
 *
 * One tick failing never stops the loop. See docs/worker.md.
 */
import { loadEnv } from "@/worker/env";
loadEnv();

import type { Address } from "viem";
import type { Prisma } from "@prisma/client";
import { getAddress, isAddress } from "viem";
import { prisma } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { getMonitoredChain } from "@/lib/chains";
import { rawToUsd, roundUsd } from "@/lib/tokens";
import { createRpcClient, fetchBalances } from "@/worker/balances";
import { getPrices } from "@/worker/prices";
import { prismaPriceStore } from "@/worker/price-store";
import { evaluate, type TokenBalance } from "@/worker/rules";
import { notifyPendingAlerts } from "@/worker/notify";

const WORKER_ID = "monitor";
const log = (msg: string, ...rest: unknown[]) => console.log(`[worker] ${new Date().toISOString()} ${msg}`, ...rest);

let stopping = false;
let priceErrorReported = false;

async function tick(): Promise<void> {
  const startedAt = Date.now();
  const chain = getMonitoredChain();
  const settings = await getSettings();

  const [clients, tokens] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, walletAddress: true, belowThreshold: true, lastCheckedAt: true, lastBalanceUsd: true },
    }),
    prisma.monitoredToken.findMany({ where: { chainId: chain.id, enabled: true } }),
  ]);

  if (tokens.length === 0) {
    log(`no enabled tokens for ${chain.name}; nothing to do`);
    return;
  }

  const wallets = clients
    .filter((c) => isAddress(c.walletAddress))
    .map((c) => ({ clientId: c.id, address: getAddress(c.walletAddress) as Address }));

  const priceResult = await getPrices(tokens.map((t) => t.coingeckoId), { store: prismaPriceStore });
  if (priceResult.stale && priceResult.error && !priceErrorReported) {
    priceErrorReported = true;
    const age = priceResult.fetchedAt ? `${Math.round((Date.now() - priceResult.fetchedAt) / 60_000)} min old` : "none";
    await createSystemAlert(
      priceResult.prices.size > 0
        ? `Price feed failed: ${priceResult.error}. Using last known prices (${age}).`
        : `Price feed failed: ${priceResult.error}. No cached prices: balance checks are skipped until CoinGecko answers.`,
    );
  }
  if (!priceResult.stale) priceErrorReported = false;
  if (priceResult.prices.size === 0) {
    log(`no prices available (${priceResult.error ?? "unknown"}); skipping tick`);
    return;
  }

  const rpc = createRpcClient(chain);
  const matrix = await fetchBalances(
    rpc,
    wallets,
    tokens.map((t) => ({ tokenId: t.id, address: t.address as Address | null })),
  );

  // Latest snapshot per (client, token) in one query.
  const latest = await prisma.balanceSnapshot.findMany({
    where: { clientId: { in: wallets.map((w) => w.clientId) } },
    orderBy: { takenAt: "desc" },
    distinct: ["clientId", "tokenId"],
    select: { clientId: true, tokenId: true, rawBalance: true },
  });
  const previousByClient = new Map<string, Map<string, bigint>>();
  for (const s of latest) {
    if (!previousByClient.has(s.clientId)) previousByClient.set(s.clientId, new Map());
    previousByClient.get(s.clientId)!.set(s.tokenId, BigInt(s.rawBalance.toFixed(0)));
  }

  let alertsCreated = 0;
  let snapshotsWritten = 0;
  const now = new Date();

  for (const client of clients) {
    const balances = matrix.get(client.id);
    if (!balances || balances.size === 0) continue;

    const current: TokenBalance[] = [];
    for (const t of tokens) {
      const raw = balances.get(t.id);
      if (raw === undefined) continue; // RPC failure for this token: keep last snapshot untouched
      const price = priceResult.prices.get(t.coingeckoId) ?? 0;
      current.push({ tokenId: t.id, symbol: t.symbol, decimals: t.decimals, raw, usd: roundUsd(rawToUsd(raw, t.decimals, price)) });
    }
    if (current.length === 0) continue;

    const previousRaw = previousByClient.get(client.id) ?? new Map<string, bigint>();
    const result = evaluate({
      current,
      previousRaw,
      wasBelowThreshold: client.belowThreshold,
      thresholdUsd: settings.threshold_usd,
      isFirstRun: client.lastCheckedAt === null,
      previousTotalUsd: client.lastBalanceUsd === null ? null : Number(client.lastBalanceUsd),
    });

    const writes = [];
    for (const change of result.changes) {
      const b = current.find((c) => c.tokenId === change.tokenId)!;
      writes.push(
        prisma.balanceSnapshot.create({
          data: { clientId: client.id, tokenId: change.tokenId, rawBalance: change.currentRaw.toString(), usdValue: b.usd, takenAt: now },
        }),
      );
    }
    snapshotsWritten += writes.length;
    for (const draft of result.alerts) {
      writes.push(prisma.alert.create({ data: { clientId: client.id, type: draft.type, message: draft.message, payload: draft.payload as Prisma.InputJsonValue } }));
    }
    writes.push(
      prisma.client.update({
        where: { id: client.id },
        data: { lastBalanceUsd: result.totalUsd, belowThreshold: result.belowThreshold, lastCheckedAt: now },
      }),
    );
    await prisma.$transaction(writes);

    for (const draft of result.alerts) {
      alertsCreated++;
      await audit({ actor: "worker", action: AuditAction.ALERT_CREATED, clientId: client.id, details: { type: draft.type, message: draft.message } });
      log(`alert ${draft.type} for ${client.walletAddress}: ${draft.message}`);
    }
  }

  const notify = await notifyPendingAlerts();
  const durationMs = Date.now() - startedAt;
  await prisma.workerState.upsert({
    where: { id: WORKER_ID },
    update: { lastRunAt: now, lastDurationMs: durationMs, lastError: null },
    create: { id: WORKER_ID, lastRunAt: now, lastDurationMs: durationMs },
  });
  log(
    `tick ok: ${wallets.length} wallets, ${tokens.length} tokens, ${snapshotsWritten} snapshots, ${alertsCreated} alerts, telegram ${notify.skipped ? "off" : `${notify.sent} sent/${notify.failed} failed`}, ${durationMs}ms${priceResult.stale ? " (stale prices)" : ""}`,
  );
}

/** One WORKER_ERROR per distinct message per 10 minutes, across restarts (the flag alone resets with the process). */
async function createSystemAlert(message: string): Promise<void> {
  const recent = await prisma.alert.findFirst({
    where: { type: "WORKER_ERROR", message, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.alert.create({ data: { type: "WORKER_ERROR", message } });
  await audit({ actor: "worker", action: AuditAction.ALERT_CREATED, details: { type: "WORKER_ERROR", message } });
}

async function recordTickFailure(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[worker] tick failed: ${message}`);
  try {
    await prisma.workerState.upsert({
      where: { id: WORKER_ID },
      update: { lastError: message },
      create: { id: WORKER_ID, lastError: message },
    });
    await audit({ actor: "worker", action: AuditAction.WORKER_TICK_FAILED, details: { error: message } });
  } catch (inner) {
    console.error("[worker] could not record failure", inner);
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      await recordTickFailure(error);
    }
    const { poll_interval_sec } = await getSettings().catch(() => ({ poll_interval_sec: 15 }));
    await sleep(poll_interval_sec * 1000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    stopSignal.push(() => {
      clearTimeout(t);
      resolve();
    });
  });
}
const stopSignal: Array<() => void> = [];

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log(`received ${signal}, shutting down`);
  for (const wake of stopSignal.splice(0)) wake();
  await audit({ actor: "worker", action: AuditAction.WORKER_STOPPED, details: { signal } });
  await prisma.$disconnect();
  process.exit(0);
}

async function main(): Promise<void> {
  const chain = getMonitoredChain();
  log(`starting on ${chain.name} (${chain.id}) via ${process.env.RPC_URL}`);
  await audit({ actor: "worker", action: AuditAction.WORKER_STARTED, details: { chainId: chain.id } });
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  await loop();
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
