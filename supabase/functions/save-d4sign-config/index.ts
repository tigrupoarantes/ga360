import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Apenas super_admin pode acessar configuração D4Sign
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userRole?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // GET — retorna configuração existente com credenciais mascaradas
    if (req.method === "GET") {
      const { data: existing } = await supabase
        .from("d4sign_config")
        .select("token_api, crypt_key, safe_id, environment, base_url, webhook_url, is_active")
        .is("company_id", null)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ config: null }), {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Retorna credenciais mascaradas — apenas primeiros 8 chars + "..."
      return new Response(JSON.stringify({
        config: {
          token_api_masked: existing.token_api
            ? `${String(existing.token_api).slice(0, 8)}...` : "",
          crypt_key_masked: existing.crypt_key
            ? `${String(existing.crypt_key).slice(0, 8)}...` : "",
          safe_id: existing.safe_id ?? "",
          environment: existing.environment ?? "sandbox",
          base_url: existing.base_url ?? "",
          webhook_url: existing.webhook_url ?? "",
          is_active: existing.is_active ?? true,
          configured: !!(existing.token_api && existing.crypt_key),
        },
      }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { config } = body;

    // Busca config existente para manter credenciais se não foram informadas
    const { data: existing } = await supabase
      .from("d4sign_config")
      .select("id, token_api, crypt_key")
      .is("company_id", null)
      .maybeSingle();

    const token_api = config?.token_api?.trim() || existing?.token_api;
    const crypt_key = config?.crypt_key?.trim() || existing?.crypt_key;

    if (!token_api || !crypt_key) {
      return new Response(
        JSON.stringify({ error: "token_api e crypt_key são obrigatórios" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const configData = {
      token_api,
      crypt_key,
      safe_id: config.safe_id || null,
      environment: config.environment || "sandbox",
      base_url: config.base_url || "https://sandbox.d4sign.com.br/api/v1",
      webhook_url: config.webhook_url || null,
      is_active: config.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let upsertError;

    if (existing?.id) {
      const { error } = await supabase
        .from("d4sign_config")
        .update(configData)
        .eq("id", existing.id);
      upsertError = error;
    } else {
      const { error } = await supabase
        .from("d4sign_config")
        .insert({ company_id: null, ...configData });
      upsertError = error;
    }

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: "Falha ao salvar configuração", details: upsertError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
