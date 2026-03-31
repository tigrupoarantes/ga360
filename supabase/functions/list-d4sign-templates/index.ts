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

    const body = await req.json();
    const { companyId } = body;

    // Retorna templates globais (company_id IS NULL) + templates da empresa se fornecida
    let query = supabase
      .from("d4sign_document_templates")
      .select("id, company_id, name, description, is_active, created_at")
      .order("created_at", { ascending: false });

    if (companyId) {
      // Templates da empresa OU globais
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    } else {
      // Só templates globais
      query = query.is("company_id", null);
    }

    const { data: templates, error: queryError } = await query;

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Falha ao listar templates", details: queryError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ templates: templates ?? [] }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
