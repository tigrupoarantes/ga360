// routes/webhooks.ts — CRUD Webhook Subscriptions + test
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ApiKeyContext } from "../_auth.ts";
import { ok, created, noContent, notFound, forbidden, serverError, err } from "../_response.ts";

function supabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const VALID_EVENTS = [
  "goal.created", "goal.updated", "goal.progress_added",
  "meeting.created", "meeting.updated", "meeting.status_changed",
];

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleWebhooks(
  req: Request, path: string, ctx: ApiKeyContext,
): Promise<Response> {
  if (!ctx.permissions.includes("webhooks:read") && !ctx.permissions.includes("webhooks:write")) {
    return forbidden();
  }
  const db = supabase();

  // POST /webhooks/:id/test
  const testMatch = path.match(/^\/webhooks\/([^/]+)\/test$/);
  if (testMatch && req.method === "POST") {
    if (!ctx.permissions.includes("webhooks:write")) return forbidden();
    return testWebhook(testMatch[1], ctx, db);
  }

  // DELETE /webhooks/:id
  const idMatch = path.match(/^\/webhooks\/([^/]+)$/);
  if (idMatch) {
    if (req.method === "DELETE") {
      if (!ctx.permissions.includes("webhooks:write")) return forbidden();
      return deleteWebhook(idMatch[1], ctx, db);
    }
    return err("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  // /webhooks
  if (path === "/webhooks") {
    if (req.method === "GET") return listWebhooks(ctx, db);
    if (req.method === "POST") {
      if (!ctx.permissions.includes("webhooks:write")) return forbidden();
      return createWebhook(req, ctx, db);
    }
  }

  return notFound("Webhooks route");
}

async function listWebhooks(ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const { data, error } = await db
    .from("webhook_subscriptions")
    .select("id, name, url, events, is_active, last_called_at, last_status, failure_count, created_at")
    .eq("company_id", ctx.companyId)
    .eq("api_key_id", ctx.apiKeyId)
    .order("created_at", { ascending: false });

  if (error) return serverError(error.message);
  return ok(data ?? []);
}

async function createWebhook(req: Request, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON", "INVALID_JSON"); }

  const { url: webhookUrl, events, name, secret: userSecret } = body as any;
  if (!webhookUrl || !events || !Array.isArray(events) || events.length === 0) {
    return err("Campos obrigatórios: url, events (array)", "MISSING_FIELDS");
  }

  // Validar URL
  try { new URL(webhookUrl); } catch { return err("URL inválida", "INVALID_URL"); }
  if (!webhookUrl.startsWith("https://")) {
    return err("Apenas URLs HTTPS são permitidas", "INVALID_URL");
  }

  // Validar events
  const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return err(`Eventos inválidos: ${invalidEvents.join(", ")}. Válidos: ${VALID_EVENTS.join(", ")}`, "INVALID_EVENTS");
  }

  const secret = userSecret ?? generateSecret();

  const { data, error } = await db.from("webhook_subscriptions").insert({
    api_key_id: ctx.apiKeyId,
    company_id: ctx.companyId,
    url: webhookUrl,
    events,
    name: name ?? "",
    secret,
  }).select("id, name, url, events, is_active, created_at").maybeSingle();

  if (error) return serverError(error.message);

  // Retorna secret UMA VEZ — depois não é exibido novamente
  return new Response(
    JSON.stringify({
      data: { ...data, secret },
      warning: "Guarde o secret em local seguro. Ele não será exibido novamente.",
    }),
    { status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
}

async function deleteWebhook(id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const { error } = await db
    .from("webhook_subscriptions")
    .delete()
    .eq("id", id)
    .eq("api_key_id", ctx.apiKeyId)
    .eq("company_id", ctx.companyId);

  if (error) return serverError(error.message);
  return noContent();
}

async function testWebhook(id: string, ctx: ApiKeyContext, db: ReturnType<typeof supabase>): Promise<Response> {
  const { data: sub } = await db
    .from("webhook_subscriptions")
    .select("url, secret")
    .eq("id", id)
    .eq("api_key_id", ctx.apiKeyId)
    .maybeSingle();

  if (!sub) return notFound("Webhook");

  const testPayload = JSON.stringify({
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: { message: "Este é um payload de teste do GA360" },
  });

  // HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(sub.secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(testPayload));
  const signature = "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  try {
    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GA360-Signature": signature,
        "X-GA360-Event": "webhook.test",
        "User-Agent": "GA360-Webhooks/1.0",
      },
      body: testPayload,
      signal: AbortSignal.timeout(10_000),
    });

    return ok({ success: res.ok, status: res.status, url: sub.url });
  } catch (e: any) {
    return ok({ success: false, error: e.message, url: sub.url });
  }
}
