import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const DELETABLE_STATUSES = new Set(["draft", "error", "cancelled"]);

interface DeleteRequest {
  documentId: string;
  companyId: string;
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

    const body = (await req.json()) as DeleteRequest;
    const { documentId, companyId } = body;

    if (!documentId || !companyId) {
      return new Response(JSON.stringify({ error: "documentId and companyId are required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const { data: document, error: docError } = await supabase
      .from("verba_indenizatoria_documents")
      .select("id, company_id, created_by, d4sign_status, generated_file_path, signed_file_path")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (docError) {
      return new Response(
        JSON.stringify({ error: "failed_to_fetch_document", details: docError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (!document) {
      return new Response(JSON.stringify({ error: "document_not_found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdmin && document.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!DELETABLE_STATUSES.has(document.d4sign_status)) {
      return new Response(
        JSON.stringify({ error: "document_status_not_deletable", status: document.d4sign_status }),
        { status: 409, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const filesToRemove = [
      document.generated_file_path,
      document.signed_file_path,
    ].filter((path): path is string => Boolean(path));

    if (filesToRemove.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("verbas-indenizatorias")
        .remove(filesToRemove);

      if (storageError) {
        return new Response(
          JSON.stringify({ error: "failed_to_remove_files", details: storageError.message }),
          { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("verba_indenizatoria_documents")
      .delete()
      .eq("id", document.id);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "failed_to_delete_document", details: deleteError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
});
