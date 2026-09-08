/** Minimal Telegram Bot API client. No SDK: one POST to sendMessage. */

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export function isTelegramConfigured(cfg: Partial<TelegramConfig>): cfg is TelegramConfig {
  return Boolean(cfg.botToken && cfg.chatId);
}

export async function sendTelegramMessage(
  cfg: TelegramConfig,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: cfg.chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { description?: string };
      if (body.description) detail = body.description;
    } catch {
      // ignore body parse errors
    }
    throw new Error(`Telegram sendMessage failed: ${detail}`);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
