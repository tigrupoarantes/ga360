import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Apenas super_admin pode salvar configuração D4Sign
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userRole?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { config } = body;

    if (!config?.token_api || !config?.crypt_key) {
      return new Response(
        JSON.stringify({ error: "token_api e crypt_key são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const configData = {
      token_api: config.token_api,
      crypt_key: config.crypt_key,
      safe_id: config.safe_id || null,
      environment: config.environment || "sandbox",
      base_url: config.base_url || "https://sandbox.d4sign.com.br/api/v1",
      webhook_url: config.webhook_url || null,
      is_active: config.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    // Two-step upsert: busca config global existente (company_id IS NULL) e atualiza,
    // ou insere nova linha global
    const { data: existing } = await supabase
      .from("d4sign_config")
      .select("id")
      .is("company_id", null)
      .maybeSingle();

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
