"use server";

import { revalidatePath } from "next/cache";
import type { AlertType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";

export interface AlertRow {
  id: string;
  type: AlertType;
  message: string;
  payload: unknown;
  readAt: Date | null;
  notifiedAt: Date | null;
  createdAt: Date;
  client: { id: string; walletAddress: string } | null;
}

const alertSelect = {
  id: true,
  type: true,
  message: true,
  payload: true,
  readAt: true,
  notifiedAt: true,
  createdAt: true,
  client: { select: { id: true, walletAddress: true } },
} as const;

export async function getUnreadAlertCount(): Promise<number> {
  if (!(await getCurrentUser())) return 0;
  return prisma.alert.count({ where: { readAt: null } });
}

export async function getRecentAlerts(limit = 5): Promise<AlertRow[]> {
  if (!(await getCurrentUser())) return [];
  return prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: alertSelect });
}

export interface AlertFilters {
  type?: AlertType | "ALL";
  unreadOnly?: boolean;
  clientId?: string;
  limit?: number;
}

export async function getAlerts(filters: AlertFilters = {}): Promise<AlertRow[]> {
  if (!(await getCurrentUser())) return [];
  return prisma.alert.findMany({
    where: {
      ...(filters.type && filters.type !== "ALL" ? { type: filters.type } : {}),
      ...(filters.unreadOnly ? { readAt: null } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 200,
    select: alertSelect,
  });
}

export async function markAlertsRead(ids: string[]): Promise<{ success: boolean; count: number }> {
  const user = await requireAdmin();
  if (ids.length === 0) return { success: true, count: 0 };
  const { count } = await prisma.alert.updateMany({ where: { id: { in: ids }, readAt: null }, data: { readAt: new Date() } });
  if (count > 0) await audit({ actor: `user:${user.id}`, action: AuditAction.ALERTS_READ, details: { ids, count } });
  revalidatePath("/admin", "layout");
  return { success: true, count };
}

export async function markAllAlertsRead(): Promise<{ success: boolean; count: number }> {
  const user = await requireAdmin();
  const { count } = await prisma.alert.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
  if (count > 0) await audit({ actor: `user:${user.id}`, action: AuditAction.ALERTS_READ, details: { all: true, count } });
  revalidatePath("/admin", "layout");
  return { success: true, count };
}
