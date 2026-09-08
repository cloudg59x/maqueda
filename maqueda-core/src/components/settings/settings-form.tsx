"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { saveSettings, sendTelegramTest } from "@/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Settings } from "@/lib/settings";

// Client-side mirror of lib/settings schema (server re-validates).
const schema = z.object({
  threshold_usd: z.coerce.number().min(0, "Must be 0 or more"),
  poll_interval_sec: z.coerce.number().int().min(5, "Min 5 seconds").max(3600, "Max 1 hour"),
  telegram_bot_token: z.string().trim(),
  telegram_chat_id: z.string().trim(),
});
type Input = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function SettingsForm({ initial }: { initial: Settings }) {
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTest] = useTransition();
  const form = useForm<Input, unknown, Values>({ resolver: zodResolver(schema), defaultValues: initial });

  function onSubmit(values: Values) {
    startTransition(async () => {
      const res = await saveSettings(values);
      if (res.success) {
        toast.success("Settings saved");
        form.reset(res.data ?? values);
      } else {
        toast.error(res.error);
      }
    });
  }

  function onTest() {
    startTest(async () => {
      const res = await sendTelegramTest();
      if (res.success) toast.success("Test message sent to Telegram");
      else toast.error(res.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>Picked up by the worker on its next tick. No restart needed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="threshold_usd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert threshold (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" inputMode="decimal" name={field.name} ref={field.ref} onBlur={field.onBlur} value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value)} />
                  </FormControl>
                  <FormDescription>
                    Alert when a wallet&apos;s total value (ETH + stablecoins) drops below this. Set <strong>0</strong> to get an alert on <strong>every</strong> balance change instead.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="poll_interval_sec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poll interval (seconds)</FormLabel>
                  <FormControl>
                    <Input type="number" min="5" max="3600" step="1" name={field.name} ref={field.ref} onBlur={field.onBlur} value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value)} />
                  </FormControl>
                  <FormDescription>How often balances are checked. 15s is fine for public RPCs; lower needs a paid endpoint.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
            <CardDescription>
              Create a bot with @BotFather, paste its token, then send the bot a message and read your chat id from{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">getUpdates</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="telegram_bot_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot token</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="off" placeholder="123456789:AA…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telegram_chat_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chat id</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 123456789 or -100…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={isTesting || form.formState.isDirty}>
              <SendIcon /> {isTesting ? "Sending…" : "Send test message"}
            </Button>
            {form.formState.isDirty && <span className="text-xs text-muted-foreground">Save first to test</span>}
          </CardFooter>
        </Card>

        <div className="flex items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? "Saving…" : "Save settings"}
          </Button>
          {form.formState.isDirty && (
            <Button type="button" variant="ghost" onClick={() => form.reset()} disabled={isPending}>
              Discard
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
