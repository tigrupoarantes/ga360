// _response.ts — Helpers de resposta padronizados (idêntico ao NossoCRM)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

export function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status, headers: JSON_HEADERS });
}

export function paginated(data: unknown[], nextCursor: string | null): Response {
  return new Response(JSON.stringify({ data, nextCursor }), { status: 200, headers: JSON_HEADERS });
}

export function created(data: unknown): Response {
  return ok(data, 201);
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function err(message: string, code: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message, code }), { status, headers: JSON_HEADERS });
}

export function unauthorized(msg = "Invalid or missing X-Api-Key"): Response {
  return err(msg, "AUTH_INVALID", 401);
}

export function forbidden(msg = "Insufficient permissions"): Response {
  return err(msg, "FORBIDDEN", 403);
}

export function notFound(resource = "Resource"): Response {
  return err(`${resource} not found`, "NOT_FOUND", 404);
}

export function serverError(msg = "Internal server error"): Response {
  return err(msg, "INTERNAL_ERROR", 500);
}

// Cursor-based pagination helper
// cursor = base64(JSON({ id, created_at })) do último item
export function encodeCursor(id: string, createdAt: string): string {
  return btoa(JSON.stringify({ id, created_at: createdAt }));
}

export function decodeCursor(cursor: string): { id: string; created_at: string } | null {
  try {
    return JSON.parse(atob(cursor));
  } catch {
    return null;
  }
}

export function getQueryParam(url: URL, key: string): string | null {
  return url.searchParams.get(key) || null;
}

export function getLimit(url: URL, defaultLimit = 50): number {
  const raw = parseInt(url.searchParams.get("limit") ?? "", 10);
  if (isNaN(raw)) return defaultLimit;
  return Math.max(1, Math.min(raw, 250));
}
