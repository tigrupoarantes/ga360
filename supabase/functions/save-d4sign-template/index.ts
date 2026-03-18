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

    // Verificar se é super_admin ou tem permissão can_manage no card
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (!isSuperAdmin) {
      const { data: cardRow } = await supabase
        .from("ec_cards")
        .select("id")
        .ilike("title", "Verbas Indenizat%")
        .eq("is_active", true)
        .maybeSingle();

      const hasPermission = cardRow?.id
        ? (await supabase.rpc("has_card_permission", {
            _user_id: user.id,
            _card_id: cardRow.id,
            _permission: "manage",
          })).data
        : false;

      if (!hasPermission) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { templateId, companyId, template, deactivate } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Desativar template
    if (deactivate && templateId) {
      const { error: deactivateError } = await supabase
        .from("d4sign_document_templates")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", templateId)
        .eq("company_id", companyId);

      if (deactivateError) {
        return new Response(
          JSON.stringify({ error: "Falha ao desativar template", details: deactivateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Criar ou editar template
    if (!template?.name || !template?.template_html) {
      return new Response(
        JSON.stringify({ error: "name e template_html são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();

    if (templateId) {
      // Editar
      const { error: updateError } = await supabase
        .from("d4sign_document_templates")
        .update({
          name: template.name,
          description: template.description || null,
          template_html: template.template_html,
          is_active: template.is_active ?? true,
          updated_at: now,
        })
        .eq("id", templateId)
        .eq("company_id", companyId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Falha ao atualizar template", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // Criar
      const { error: insertError } = await supabase
        .from("d4sign_document_templates")
        .insert({
          company_id: companyId,
          name: template.name,
          description: template.description || null,
          template_html: template.template_html,
          template_type: "verba_indenizatoria",
          is_active: true,
          created_by: user.id,
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Falha ao criar template", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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
