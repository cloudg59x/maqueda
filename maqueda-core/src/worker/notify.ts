/**
 * Delivers pending alerts (notifiedAt = null) to Telegram.
 * Shared by the worker tick and reusable from server actions.
 */
import { prisma } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { escapeHtml, isTelegramConfigured, sendTelegramMessage } from "@/worker/telegram";
import { shortAddress } from "@/lib/tokens";

const MAX_PER_RUN = 20;

export async function notifyPendingAlerts(): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const settings = await getSettings();
  const cfg = { botToken: settings.telegram_bot_token, chatId: settings.telegram_chat_id };
  if (!isTelegramConfigured(cfg)) return { sent: 0, failed: 0, skipped: true };

  const pending = await prisma.alert.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
    include: { client: { select: { walletAddress: true, network: true } } },
  });

  let sent = 0;
  let failed = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const alert of pending) {
    const title = TITLES[alert.type] ?? alert.type;
    const wallet = alert.client ? `<code>${shortAddress(alert.client.walletAddress)}</code>` : "";
    const link = alert.clientId && appUrl ? `\n<a href="${appUrl}/admin/clients/${alert.clientId}">Open in admin</a>` : "";
    const text = `<b>${title}</b> ${wallet}\n${escapeHtml(alert.message)}${link}`;
    try {
      await sendTelegramMessage(cfg, text);
      await prisma.alert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } });
      await audit({ actor: "worker", action: AuditAction.NOTIFICATION_SENT, clientId: alert.clientId, details: { alertId: alert.id, channel: "telegram" } });
      sent++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      await audit({ actor: "worker", action: AuditAction.NOTIFICATION_FAILED, clientId: alert.clientId, details: { alertId: alert.id, channel: "telegram", error: message } });
      console.error(`[worker] telegram delivery failed for alert ${alert.id}: ${message}`);
      // Stop after the first failure: if Telegram is down, the rest will fail too. Retried next tick.
      break;
    }
  }
  return { sent, failed, skipped: false };
}

const TITLES: Record<string, string> = {
  BELOW_THRESHOLD: "⚠️ Below threshold",
  BACK_ABOVE: "✅ Back above threshold",
  BALANCE_CHANGED: "🔔 Balance changed",
  WORKER_ERROR: "🛑 Worker error",
};
