"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { getSettings, updateSettings, settingsSchema, type Settings } from "@/lib/settings";
import { getMonitoredChain } from "@/lib/chains";
import { isTelegramConfigured, sendTelegramMessage } from "@/worker/telegram";

export type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

export async function loadSettings(): Promise<Settings> {
  await requireAdmin();
  return getSettings();
}

export type SettingsFormValues = z.input<typeof settingsSchema>;

export async function saveSettings(values: SettingsFormValues): Promise<ActionResult<Settings>> {
  try {
    const user = await requireAdmin();
    const parsed = settingsSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
    const next = await updateSettings(parsed.data, `user:${user.id}`);
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    return { success: true, data: next };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to save settings" };
  }
}

export async function sendTelegramTest(): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const s = await getSettings();
    const cfg = { botToken: s.telegram_bot_token, chatId: s.telegram_chat_id };
    if (!isTelegramConfigured(cfg)) return { success: false, error: "Save a bot token and chat id first" };
    await sendTelegramMessage(cfg, "✅ <b>Maqueda</b> test message. Telegram alerts are working.");
    await audit({ actor: `user:${user.id}`, action: AuditAction.TELEGRAM_TEST_SENT });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Telegram test failed" };
  }
}

export interface MonitoredTokenRow {
  id: string;
  chainId: string;
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  coingeckoId: string;
  enabled: boolean;
  isCurrentChain: boolean;
}

export async function getMonitoredTokens(): Promise<MonitoredTokenRow[]> {
  if (!(await getCurrentUser())) return [];
  let currentChainId: string | null = null;
  try {
    currentChainId = getMonitoredChain().id;
  } catch {
    currentChainId = null;
  }
  const rows = await prisma.monitoredToken.findMany({ orderBy: [{ chainId: "asc" }, { symbol: "asc" }] });
  return rows.map((r) => ({ ...r, isCurrentChain: r.chainId === currentChainId }));
}

const tokenUpdateSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  address: z
    .string()
    .trim()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 0x address")
    .nullable()
    .optional(),
});

export async function updateMonitoredToken(input: z.infer<typeof tokenUpdateSchema>): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = tokenUpdateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
    const before = await prisma.monitoredToken.findUnique({ where: { id: parsed.data.id } });
    if (!before) return { success: false, error: "Token not found" };
    if (parsed.data.enabled && !before.address && !parsed.data.address && before.symbol !== "ETH") {
      return { success: false, error: "Set a contract address before enabling this token" };
    }
    const after = await prisma.monitoredToken.update({
      where: { id: parsed.data.id },
      data: { enabled: parsed.data.enabled, ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}) },
    });
    await audit({
      actor: `user:${user.id}`,
      action: AuditAction.TOKEN_TOGGLED,
      details: { symbol: after.symbol, chainId: after.chainId, enabled: { from: before.enabled, to: after.enabled }, address: { from: before.address, to: after.address } },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/clients");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update token" };
  }
}
