// _auth.ts — Validação de API Key via SHA-256 hash
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ApiKeyContext {
  apiKeyId: string;
  companyId: string | null;
  companyName: string;
  keyPrefix: string;
  permissions: string[];
  isGlobal: boolean;
}

// Computa SHA-256 hex de uma string (Web Crypto API — disponível no Deno)
async function sha256hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validateApiKey(req: Request): Promise<ApiKeyContext | null> {
  const rawKey = req.headers.get("x-api-key");
  if (!rawKey?.startsWith("ga360_")) return null;

  const hash = await sha256hex(rawKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: keyRow, error } = await supabase
    .from("public_api_keys")
    .select("id, company_id, is_global, key_prefix, permissions, companies(name)")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !keyRow) return null;

  // Atualiza last_used_at de forma assíncrona (fire-and-forget)
  supabase
    .from("public_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  const isGlobal = keyRow.is_global ?? false;

  return {
    apiKeyId: keyRow.id,
    companyId: keyRow.company_id ?? null,
    companyName: (keyRow.companies as any)?.name ?? (isGlobal ? "Global" : ""),
    keyPrefix: keyRow.key_prefix,
    permissions: keyRow.permissions ?? [],
    isGlobal,
  };
}

export function hasPermission(ctx: ApiKeyContext, required: string): boolean {
  return ctx.permissions.includes(required);
}

// Gera uma nova API key no formato ga360_<random32chars>
// Retorna { fullKey, hash, prefix } — fullKey é mostrado UMA VEZ e descartado
export async function generateApiKey(): Promise<{ fullKey: string; hash: string; prefix: string }> {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const fullKey = `ga360_${randomPart}`;
  const hash = await sha256hex(fullKey);
  const prefix = fullKey.slice(0, 20); // "ga360_" + 14 chars = 20
  return { fullKey, hash, prefix };
}
