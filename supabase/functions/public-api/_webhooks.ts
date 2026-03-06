// _webhooks.ts — Dispatch de webhooks para endpoints externos (n8n, Make, etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type WebhookEvent =
  | "goal.created"
  | "goal.updated"
  | "goal.progress_added"
  | "meeting.created"
  | "meeting.updated"
  | "meeting.status_changed";

// Assina o payload com HMAC-SHA256 para que o receptor verifique autenticidade
async function hmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);
  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  const sigArray = Array.from(new Uint8Array(sig));
  return "sha256=" + sigArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Dispara webhooks de forma assíncrona (fire-and-forget)
// Não bloqueia a resposta da API
export function dispatchWebhooks(
  companyId: string,
  event: WebhookEvent,
  data: unknown,
): void {
  // Executar em background sem await
  (async () => {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: subs } = await supabase
        .from("webhook_subscriptions")
        .select("id, url, secret, events")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .contains("events", [event]);

      if (!subs?.length) return;

      const timestamp = new Date().toISOString();
      const payload = JSON.stringify({ event, timestamp, data });

      await Promise.allSettled(
        subs.map(async (sub: { id: string; url: string; secret: string }) => {
          const signature = await hmacSha256(sub.secret, payload);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);

          try {
            const res = await fetch(sub.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-GA360-Signature": signature,
                "X-GA360-Event": event,
                "X-GA360-Timestamp": timestamp,
                "User-Agent": "GA360-Webhooks/1.0",
              },
              body: payload,
              signal: controller.signal,
            });

            await supabase
              .from("webhook_subscriptions")
              .update({
                last_called_at: timestamp,
                last_status: res.status,
                failure_count: res.ok ? 0 : supabase.rpc, // reset on success
              })
              .eq("id", sub.id);

            if (!res.ok) {
              await supabase
                .from("webhook_subscriptions")
                .update({ failure_count: sub.failure_count + 1 } as any)
                .eq("id", sub.id);
            }
          } catch {
            await supabase
              .from("webhook_subscriptions")
              .update({ last_status: 0 } as any)
              .eq("id", sub.id);
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
    } catch {
      // Silently fail — webhook dispatch never breaks API response
    }
  })();
}
