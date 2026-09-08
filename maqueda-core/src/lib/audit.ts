import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Who performed an action. Users are "user:<id>", automation is "worker", the public dApp is "dapp". */
export type AuditActor = `user:${string}` | "worker" | "dapp" | "system";

export interface AuditEntry {
  actor: AuditActor;
  action: string;
  userId?: string | null;
  clientId?: string | null;
  details?: Prisma.InputJsonValue | Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Append one audit row. Never throws: an audit failure must not break the action being audited. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        userId: entry.userId ?? (entry.actor.startsWith("user:") ? entry.actor.slice(5) : null),
        clientId: entry.clientId ?? null,
        details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write entry", entry.action, error);
  }
}

/** Action names used across the app. Keep them stable: they are filtered on in the UI. */
export const AuditAction = {
  // admin auth
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  // admin users
  USER_CREATED: "USER_CREATED",
  USER_DELETED: "USER_DELETED",
  // clients
  CLIENT_CONNECTED: "CLIENT_CONNECTED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  CLIENT_ACTIVATED: "CLIENT_ACTIVATED",
  CLIENT_DEACTIVATED: "CLIENT_DEACTIVATED",
  CLIENT_DELETED: "CLIENT_DELETED",
  // settings
  SETTINGS_CHANGED: "SETTINGS_CHANGED",
  TOKEN_TOGGLED: "TOKEN_TOGGLED",
  TELEGRAM_TEST_SENT: "TELEGRAM_TEST_SENT",
  // alerts
  ALERTS_READ: "ALERTS_READ",
  // worker
  WORKER_STARTED: "WORKER_STARTED",
  WORKER_STOPPED: "WORKER_STOPPED",
  WORKER_TICK_FAILED: "WORKER_TICK_FAILED",
  ALERT_CREATED: "ALERT_CREATED",
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  NOTIFICATION_FAILED: "NOTIFICATION_FAILED",
} as const;
export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];
