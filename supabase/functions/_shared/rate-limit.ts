// _shared/rate-limit.ts — Rate limiting via Supabase para Edge Functions do GA360
// Usa a tabela two_factor_codes como base para 2FA, e uma abordagem genérica por IP para outros endpoints.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitOptions {
  /** Identificador único (IP, email, userId) */
  key: string;
  /** Namespace do endpoint (ex: 'send-2fa', 'password-reset', 'create-user') */
  endpoint: string;
  /** Máximo de requests permitidos na janela */
  maxRequests: number;
  /** Janela de tempo em segundos (default: 3600 = 1 hora) */
  windowSeconds?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Verifica rate limit usando a tabela `rate_limits` no Supabase.
 * Cria registro se não existir, incrementa se existir.
 * Resets automáticos após expiração da janela.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { key, endpoint, maxRequests, windowSeconds = 3600 } = options;
  const compositeKey = `${endpoint}:${key}`;

  // Buscar registro existente
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, request_count, window_start")
    .eq("key", compositeKey)
    .single();

  const now = new Date();

  if (existing) {
    const windowStart = new Date(existing.window_start);
    const windowEnd = new Date(windowStart.getTime() + windowSeconds * 1000);

    // Janela expirou — resetar
    if (now > windowEnd) {
      await supabase
        .from("rate_limits")
        .update({ request_count: 1, window_start: now.toISOString() })
        .eq("id", existing.id);

      return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
    }

    // Dentro da janela — verificar limite
    if (existing.request_count >= maxRequests) {
      const retryAfter = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
    }

    // Incrementar contador
    await supabase
      .from("rate_limits")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);

    return {
      allowed: true,
      remaining: maxRequests - existing.request_count - 1,
      retryAfterSeconds: 0,
    };
  }

  // Primeiro request — criar registro
  await supabase
    .from("rate_limits")
    .insert({ key: compositeKey, request_count: 1, window_start: now.toISOString() });

  return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
}

/** Extrai IP do request (Supabase Edge Functions recebem via headers) */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/** Response 429 padronizada */
export function tooManyRequests(
  retryAfterSeconds: number,
  headers: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "Muitas tentativas. Tente novamente mais tarde.",
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
