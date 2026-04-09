import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Reprocessa documentos VI com status "error":
// Analisa campos existentes para determinar o status correto de reset,
// permitindo que send-drafts-to-d4sign retome o processamento.

interface ReprocessRequest {
  documentId: string;
  companyId: string;
  signerEmail?: string; // opcional: corrigir email do signatário
}

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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid_token", debug: userError?.message ?? "user_null" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReprocessRequest;
    const { documentId, companyId, signerEmail } = body;

    if (!documentId || !companyId) {
      return new Response(JSON.stringify({ error: "documentId and companyId are required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Permissões (mesmo padrão de delete-verba-indenizatoria-doc)
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

      if (cardRow?.id) {
        const { data: cardPermission } = await supabase.rpc("has_card_permission", {
          _user_id: user.id,
          _card_id: cardRow.id,
          _permission: "view",
        });

        if (!cardPermission) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }

      const { data: userCompany } = await supabase
        .from("user_companies")
        .select("company_id, all_companies")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const hasCompanyAccess =
        userCompany?.all_companies ||
        userCompany?.company_id === companyId;

      if (!hasCompanyAccess) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    // Buscar documento
    const { data: doc, error: docError } = await supabase
      .from("verba_indenizatoria_documents")
      .select("id, company_id, d4sign_status, d4sign_error_message, d4sign_document_uuid, d4sign_signer_email, employee_email, generated_file_path")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (docError) {
      return new Response(
        JSON.stringify({ error: "failed_to_fetch_document", details: docError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (!doc) {
      return new Response(JSON.stringify({ error: "document_not_found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (doc.d4sign_status !== "error") {
      return new Response(
        JSON.stringify({ error: "document_not_in_error", status: doc.d4sign_status }),
        { status: 409, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Verificar se o PDF existe
    if (!doc.generated_file_path) {
      return new Response(
        JSON.stringify({ error: "no_pdf", message: "Documento sem PDF gerado. Delete e regenere o documento." }),
        { status: 422, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const errorMsg = (doc.d4sign_error_message || "").toLowerCase();
    const isEmailError = errorMsg.includes("email") || errorMsg.includes("signat");

    // Se erro de email e nenhum email fornecido, pedir correção
    if (isEmailError && !signerEmail && !doc.employee_email) {
      return new Response(
        JSON.stringify({ error: "email_required", message: "Erro de email. Forneça o email do signatário para reprocessar." }),
        { status: 422, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Determinar status de reset
    let newStatus: string;
    if (!doc.d4sign_document_uuid) {
      // Upload nunca aconteceu → voltar para draft
      newStatus = "draft";
    } else {
      // Upload já aconteceu → voltar para uploaded (refaz signer + send)
      newStatus = "uploaded";
    }

    // Preparar update
    const updateFields: Record<string, unknown> = {
      d4sign_status: newStatus,
      d4sign_error_message: null,
    };

    if (signerEmail) {
      updateFields.employee_email = signerEmail;
      updateFields.d4sign_signer_email = signerEmail;
    }

    const { error: updateError } = await supabase
      .from("verba_indenizatoria_documents")
      .update(updateFields)
      .eq("id", doc.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "failed_to_update", details: updateError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Log de reprocessamento
    await supabase.from("verba_indenizatoria_logs").insert({
      document_id: doc.id,
      action: "reprocess",
      details: {
        previous_error: doc.d4sign_error_message,
        new_status: newStatus,
        email_updated: signerEmail || null,
      },
      performed_by: user.id,
    });

    console.log(`[reprocess-vi-error] ${doc.id}: error → ${newStatus} | email_updated: ${!!signerEmail}`);

    return new Response(
      JSON.stringify({
        ok: true,
        documentId: doc.id,
        newStatus,
        previousError: doc.d4sign_error_message,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
