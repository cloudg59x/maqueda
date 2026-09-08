import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, AuditAction, type AuditActor } from "@/lib/audit";

/**
 * App settings live in the `Setting` key/value table so they can be edited from the UI
 * and picked up by the worker on its next tick without a restart.
 */
export const settingsSchema = z.object({
  /** Alert when a wallet's total USD value drops below this. 0 = alert on every balance change. */
  threshold_usd: z.coerce.number().min(0).default(0),
  /** Seconds between worker ticks. */
  poll_interval_sec: z.coerce.number().int().min(5).max(3600).default(15),
  telegram_bot_token: z.string().trim().default(""),
  telegram_chat_id: z.string().trim().default(""),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsKey = keyof Settings;

export const SETTINGS_DEFAULTS: Settings = settingsSchema.parse({});

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : SETTINGS_DEFAULTS;
}

/** Persist changed keys only, and audit a before/after diff. */
export async function updateSettings(input: Partial<Settings>, actor: AuditActor): Promise<Settings> {
  const current = await getSettings();
  const next = settingsSchema.parse({ ...current, ...input });

  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(next) as SettingsKey[]) {
    if (current[key] !== next[key]) {
      diff[key] = {
        from: redact(key, current[key]),
        to: redact(key, next[key]),
      };
    }
  }
  if (Object.keys(diff).length === 0) return current;

  await prisma.$transaction(
    (Object.keys(diff) as SettingsKey[]).map((key) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(next[key]) },
        create: { key, value: String(next[key]) },
      }),
    ),
  );
  await audit({ actor, action: AuditAction.SETTINGS_CHANGED, details: diff });
  return next;
}

function redact(key: SettingsKey, value: unknown): unknown {
  if (key === "telegram_bot_token" && typeof value === "string" && value.length > 8) {
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
  }
  return value;
}
