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

    // Verificar se é super_admin ou tem permissão can_manage no card
    const { data: userRoleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = userRoleRow?.role === "super_admin";
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
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { templateId, companyId, template, deactivate } = body;

    // companyId é opcional para super_admin — null/vazio cria template global (todas as empresas)
    const resolvedCompanyId: string | null = companyId || null;

    // Excluir template
    if (deactivate && templateId) {
      const { error: deleteError } = await supabase
        .from("d4sign_document_templates")
        .delete()
        .eq("id", templateId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "Falha ao excluir template", details: deleteError.message }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Criar ou editar template
    if (!template?.name || !template?.template_html) {
      return new Response(
        JSON.stringify({ error: "name e template_html são obrigatórios" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();

    if (templateId) {
      // Editar
      let updateQuery = supabase
        .from("d4sign_document_templates")
        .update({
          name: template.name,
          description: template.description || null,
          template_html: template.template_html,
          is_active: template.is_active ?? true,
          updated_at: now,
        })
        .eq("id", templateId);

      if (resolvedCompanyId) {
        updateQuery = updateQuery.eq("company_id", resolvedCompanyId);
      } else {
        updateQuery = updateQuery.is("company_id", null);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Falha ao atualizar template", details: updateError.message }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    } else {
      // Criar
      const { error: insertError } = await supabase
        .from("d4sign_document_templates")
        .insert({
          company_id: resolvedCompanyId,
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
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
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
