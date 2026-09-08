"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export interface DashboardStats {
  activeClients: number;
  inactiveClients: number;
  belowThreshold: number;
  unreadAlerts: number;
  totalUsd: number;
  thresholdUsd: number;
  pollIntervalSec: number;
  worker: {
    lastRunAt: Date | null;
    lastDurationMs: number | null;
    lastError: string | null;
    healthy: boolean; // ran within 2x the poll interval
  };
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  if (!(await getCurrentUser())) return null;
  const [activeClients, inactiveClients, belowThreshold, unreadAlerts, totalAgg, settings, worker] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.count({ where: { isActive: false } }),
    prisma.client.count({ where: { isActive: true, belowThreshold: true } }),
    prisma.alert.count({ where: { readAt: null } }),
    prisma.client.aggregate({ where: { isActive: true }, _sum: { lastBalanceUsd: true } }),
    getSettings(),
    prisma.workerState.findUnique({ where: { id: "monitor" } }),
  ]);
  const lastRunAt = worker?.lastRunAt ?? null;
  const healthy = lastRunAt !== null && Date.now() - lastRunAt.getTime() < settings.poll_interval_sec * 2000 + 5000;
  return {
    activeClients,
    inactiveClients,
    belowThreshold,
    unreadAlerts,
    totalUsd: Number(totalAgg._sum.lastBalanceUsd ?? 0),
    thresholdUsd: settings.threshold_usd,
    pollIntervalSec: settings.poll_interval_sec,
    worker: { lastRunAt, lastDurationMs: worker?.lastDurationMs ?? null, lastError: worker?.lastError ?? null, healthy },
  };
}
