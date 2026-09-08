"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { getMonitoredChain } from "@/lib/chains";

export interface TokenBalanceView {
  tokenId: string;
  symbol: string;
  decimals: number;
  raw: string; // bigint as string, safe for RSC serialization
  usd: number;
  takenAt: Date | null;
}

export interface ClientListRow {
  id: string;
  walletAddress: string;
  network: string | null;
  country: string | null;
  city: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  firstSeen: Date;
  lastSeen: Date;
  isActive: boolean;
  belowThreshold: boolean;
  lastBalanceUsd: number | null;
  lastCheckedAt: Date | null;
  balances: TokenBalanceView[]; // one per enabled token on the monitored chain, in symbol order
}

/** Latest snapshot per (client, token), joined onto every client. One query for snapshots. */
export async function getClientsWithBalances(): Promise<ClientListRow[]> {
  if (!(await getCurrentUser())) return [];
  const chain = safeChain();
  const [clients, tokens] = await Promise.all([
    prisma.client.findMany({
      orderBy: { lastSeen: "desc" },
      select: {
        id: true, walletAddress: true, network: true, country: true, city: true, deviceType: true, os: true, browser: true,
        firstSeen: true, lastSeen: true, isActive: true, belowThreshold: true, lastBalanceUsd: true, lastCheckedAt: true,
      },
    }),
    chain ? prisma.monitoredToken.findMany({ where: { chainId: chain.id, enabled: true }, orderBy: { symbol: "asc" } }) : [],
  ]);
  const latest = await prisma.balanceSnapshot.findMany({
    where: { clientId: { in: clients.map((c) => c.id) } },
    orderBy: { takenAt: "desc" },
    distinct: ["clientId", "tokenId"],
    select: { clientId: true, tokenId: true, rawBalance: true, usdValue: true, takenAt: true },
  });
  const byClient = new Map<string, Map<string, (typeof latest)[number]>>();
  for (const s of latest) {
    if (!byClient.has(s.clientId)) byClient.set(s.clientId, new Map());
    byClient.get(s.clientId)!.set(s.tokenId, s);
  }
  return clients.map((c) => ({
    ...c,
    lastBalanceUsd: c.lastBalanceUsd === null ? null : Number(c.lastBalanceUsd),
    balances: tokens.map((t) => {
      const s = byClient.get(c.id)?.get(t.id);
      return {
        tokenId: t.id,
        symbol: t.symbol,
        decimals: t.decimals,
        raw: s ? s.rawBalance.toFixed(0) : "0",
        usd: s ? Number(s.usdValue) : 0,
        takenAt: s?.takenAt ?? null,
      };
    }),
  }));
}

export interface ClientDetail extends ClientListRow {
  ipAddress: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  userAgent: string | null;
  screenInfo: string | null;
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  if (!(await getCurrentUser())) return null;
  const chain = safeChain();
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return null;
  const tokens = chain ? await prisma.monitoredToken.findMany({ where: { chainId: chain.id, enabled: true }, orderBy: { symbol: "asc" } }) : [];
  const latest = await prisma.balanceSnapshot.findMany({
    where: { clientId: id },
    orderBy: { takenAt: "desc" },
    distinct: ["tokenId"],
    select: { tokenId: true, rawBalance: true, usdValue: true, takenAt: true },
  });
  const byToken = new Map(latest.map((s) => [s.tokenId, s]));
  return {
    ...client,
    lastBalanceUsd: client.lastBalanceUsd === null ? null : Number(client.lastBalanceUsd),
    balances: tokens.map((t) => {
      const s = byToken.get(t.id);
      return { tokenId: t.id, symbol: t.symbol, decimals: t.decimals, raw: s ? s.rawBalance.toFixed(0) : "0", usd: s ? Number(s.usdValue) : 0, takenAt: s?.takenAt ?? null };
    }),
  };
}

export interface HistoryPoint {
  takenAt: string; // ISO
  totalUsd: number;
  perToken: Record<string, number>;
}

/**
 * USD history for the chart. Snapshots are sparse (written on change only), so we
 * carry the last known value of each token forward to build a step series.
 */
export async function getClientBalanceHistory(id: string, days = 30): Promise<HistoryPoint[]> {
  if (!(await getCurrentUser())) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snapshots = await prisma.balanceSnapshot.findMany({
    where: { clientId: id, takenAt: { gte: since } },
    orderBy: { takenAt: "asc" },
    include: { token: { select: { symbol: true } } },
  });
  // Seed with the latest value before the window so the series does not start from zero.
  const seed = await prisma.balanceSnapshot.findMany({
    where: { clientId: id, takenAt: { lt: since } },
    orderBy: { takenAt: "desc" },
    distinct: ["tokenId"],
    include: { token: { select: { symbol: true } } },
  });
  const current: Record<string, number> = {};
  for (const s of seed) current[s.token.symbol] = Number(s.usdValue);

  const points: HistoryPoint[] = [];
  if (seed.length > 0) points.push({ takenAt: since.toISOString(), totalUsd: sum(current), perToken: { ...current } });
  let lastKey = "";
  for (const s of snapshots) {
    current[s.token.symbol] = Number(s.usdValue);
    const key = s.takenAt.toISOString();
    if (key === lastKey) {
      points[points.length - 1] = { takenAt: key, totalUsd: sum(current), perToken: { ...current } };
    } else {
      points.push({ takenAt: key, totalUsd: sum(current), perToken: { ...current } });
      lastKey = key;
    }
  }
  return points;
}

export interface AuditRow {
  id: string;
  actor: string;
  action: string;
  details: unknown;
  ipAddress: string | null;
  timestamp: Date;
  user: { email: string } | null;
}

export async function getClientAuditLog(id: string, limit = 100): Promise<AuditRow[]> {
  if (!(await getCurrentUser())) return [];
  return prisma.auditLog.findMany({
    where: { clientId: id },
    orderBy: { timestamp: "desc" },
    take: limit,
    select: { id: true, actor: true, action: true, details: true, ipAddress: true, timestamp: true, user: { select: { email: true } } },
  });
}

export async function setClientActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();
    const client = await prisma.client.update({ where: { id }, data: { isActive }, select: { id: true, walletAddress: true } });
    await audit({
      actor: `user:${user.id}`,
      action: isActive ? AuditAction.CLIENT_ACTIVATED : AuditAction.CLIENT_DEACTIVATED,
      clientId: client.id,
      details: { walletAddress: client.walletAddress },
    });
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${id}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update client" };
  }
}

export async function deleteClient(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();
    const client = await prisma.client.delete({ where: { id }, select: { walletAddress: true } });
    await audit({ actor: `user:${user.id}`, action: AuditAction.CLIENT_DELETED, details: { clientId: id, walletAddress: client.walletAddress } });
    revalidatePath("/admin/clients");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete client" };
  }
}

function safeChain() {
  try {
    return getMonitoredChain();
  } catch {
    return null;
  }
}

function sum(rec: Record<string, number>): number {
  return Math.round(Object.values(rec).reduce((a, b) => a + b, 0) * 100) / 100;
}
