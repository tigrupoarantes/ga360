import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Processa 1 documento, 1 etapa por vez para D4Sign.
// Etapas: draft → uploaded → signers_added → sent_to_sign
// Cada invocação faz no máximo 1 chamada API à D4Sign (cabe no timeout de 60s).

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

function sanitize(text: string): string {
  const map: Record<string, string> = {
    "á": "a", "à": "a", "â": "a", "ã": "a", "é": "e", "ê": "e",
    "í": "i", "ó": "o", "ô": "o", "õ": "o", "ú": "u", "ç": "c",
    "Á": "A", "À": "A", "Â": "A", "Ã": "A", "É": "E", "Ê": "E",
    "Í": "I", "Ó": "O", "Ô": "O", "Õ": "O", "Ú": "U", "Ç": "C",
  };
  return text.replace(/[^\x00-\x7F]/g, (char) => map[char] ?? "?");
}

interface SendRequest {
  companyId: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SendRequest;
    const { companyId } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Config D4Sign
    const { data: d4config } = await supabase
      .from("d4sign_config")
      .select("token_api, crypt_key, safe_id, base_url")
      .is("company_id", null)
      .eq("is_active", true)
      .maybeSingle();

    if (!d4config?.token_api || !d4config?.safe_id) {
      return new Response(JSON.stringify({ error: "D4Sign não configurado" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const baseUrl = d4config.base_url.replace(/\/+$/, "");

    function buildUrl(path: string): string {
      const url = new URL(`${baseUrl}/${path}`);
      url.searchParams.set("tokenAPI", d4config!.token_api);
      url.searchParams.set("cryptKey", d4config!.crypt_key);
      return url.toString();
    }

    // Fetch com timeout de 50s (cabe no limite de 60s da Edge Function)
    async function callD4Sign(url: string, method: string, fetchBody?: BodyInit, contentType?: string): Promise<{ ok: boolean; status: number; data: unknown }> {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (contentType) headers["Content-Type"] = contentType;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50_000);

      try {
        const resp = await fetch(url, { method, headers, body: fetchBody, signal: controller.signal });
        clearTimeout(timeoutId);
        const text = await resp.text();
        let data: unknown;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        return { ok: resp.ok, status: resp.status, data };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === "AbortError") {
          return { ok: false, status: 408, data: { error: "D4Sign API timeout (50s)" } };
        }
        throw err;
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = Deno.env.get("D4SIGN_WEBHOOK_URL") || `${supabaseUrl}/functions/v1/d4sign-webhook`;
    const webhookSecret = Deno.env.get("D4SIGN_WEBHOOK_SECRET");

    // Buscar 1 documento que precisa da próxima ação (prioridade: signers_added > uploaded > draft)
    const { data: doc } = await supabase
      .from("verba_indenizatoria_documents")
      .select("id, employee_name, employee_cpf, employee_email, competencia, generated_file_path, d4sign_status, d4sign_signer_email, d4sign_document_uuid")
      .eq("company_id", companyId)
      .in("d4sign_status", ["draft", "uploaded", "signers_added"])
      .not("generated_file_path", "is", null)
      .order("d4sign_status") // draft < signers_added < uploaded (alpha sort avança os mais prontos primeiro)
      .limit(1)
      .maybeSingle();

    if (!doc) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, action: "none", message: "Nenhum documento pendente" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    let action = "";
    let newStatus = "";
    let errorMsg: string | null = null;
    let success = false;

    try {
      // ── ETAPA 1: draft → uploaded (upload PDF para D4Sign) ──
      if (doc.d4sign_status === "draft") {
        action = "upload";

        const { data: pdfData, error: dlError } = await supabase.storage
          .from("verbas-indenizatorias")
          .download(doc.generated_file_path);

        if (dlError || !pdfData) {
          errorMsg = "PDF não encontrado no Storage";
        } else {
          const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
          const fileName = `verba_${sanitize(doc.employee_name).replace(/\s+/g, "_")}_${doc.competencia}.pdf`;

          const blob = new Blob([pdfBytes], { type: "application/pdf" });
          const formData = new FormData();
          formData.append("file", blob, fileName);
          formData.append("name", fileName);

          const uploadUrl = buildUrl(`documents/${d4config.safe_id}/upload`);
          const result = await callD4Sign(uploadUrl, "POST", formData);

          if (!result.ok) {
            errorMsg = `upload: ${JSON.stringify(result.data).slice(0, 200)}`;
          } else {
            const d4data = result.data as Record<string, unknown>;
            const uuid = (d4data?.uuid as string) || ((d4data?.document as Record<string, unknown>)?.uuid as string);

            if (!uuid) {
              errorMsg = "upload ok mas uuid não retornado";
            } else {
              await supabase.from("verba_indenizatoria_documents").update({
                d4sign_document_uuid: uuid,
                d4sign_safe_uuid: d4config.safe_id,
                d4sign_status: "uploaded",
                d4sign_error_message: null,
              }).eq("id", doc.id);
              newStatus = "uploaded";
              success = true;
            }
          }
        }
      }

      // ── ETAPA 2: uploaded → signers_added (webhook + signatário) ──
      else if (doc.d4sign_status === "uploaded") {
        action = "add_signer";
        const uuid = doc.d4sign_document_uuid;

        if (!uuid) {
          errorMsg = "documento sem uuid D4Sign";
        } else {
          // Registrar webhook
          const webhookBody: Record<string, string> = { url: webhookUrl };
          if (webhookSecret) webhookBody.token = webhookSecret;
          await callD4Sign(
            buildUrl(`documents/${uuid}/webhooks`),
            "POST",
            JSON.stringify(webhookBody),
            "application/json",
          );

          // Adicionar signatário
          const signerEmail = doc.employee_email || doc.d4sign_signer_email;

          if (!signerEmail) {
            errorMsg = "email do signatário vazio";
          } else {
            const result = await callD4Sign(
              buildUrl(`documents/${uuid}/createlist`),
              "POST",
              JSON.stringify({ signers: [{ email: signerEmail, act: "1", foreign: "0", foreignLang: "" }] }),
              "application/json",
            );

            if (!result.ok) {
              errorMsg = `add_signer: ${JSON.stringify(result.data).slice(0, 200)}`;
              await supabase.from("verba_indenizatoria_logs").insert({
                document_id: doc.id, action: "error",
                details: { step: "add_signer", email: signerEmail, response: result.data },
                performed_by: user.id,
              });
            } else {
              await supabase.from("verba_indenizatoria_documents").update({
                d4sign_status: "signers_added",
                d4sign_signer_email: signerEmail,
                d4sign_error_message: null,
              }).eq("id", doc.id);
              newStatus = "signers_added";
              success = true;
            }
          }
        }
      }

      // ── ETAPA 3: signers_added → sent_to_sign (enviar para assinatura) ──
      else if (doc.d4sign_status === "signers_added") {
        action = "send_to_sign";
        const uuid = doc.d4sign_document_uuid;

        if (!uuid) {
          errorMsg = "documento sem uuid D4Sign";
        } else {
          const result = await callD4Sign(
            buildUrl(`documents/${uuid}/sendtosigner`),
            "POST",
            JSON.stringify({}),
            "application/json",
          );

          if (!result.ok) {
            errorMsg = `send_to_sign: ${JSON.stringify(result.data).slice(0, 200)}`;
          } else {
            await supabase.from("verba_indenizatoria_documents").update({
              d4sign_status: "sent_to_sign",
              d4sign_sent_at: new Date().toISOString(),
              d4sign_error_message: null,
            }).eq("id", doc.id);

            await supabase.from("verba_indenizatoria_logs").insert({
              document_id: doc.id,
              action: "sent_to_sign",
              details: { source: "send-drafts-to-d4sign", d4sign_uuid: uuid },
              performed_by: user.id,
            });

            newStatus = "sent_to_sign";
            success = true;
          }
        }
      }

      // Se houve erro, marcar como error
      if (errorMsg) {
        await supabase.from("verba_indenizatoria_documents").update({
          d4sign_status: "error",
          d4sign_error_message: errorMsg,
        }).eq("id", doc.id);

        await supabase.from("verba_indenizatoria_logs").insert({
          document_id: doc.id,
          action: "error",
          details: { source: "send-drafts-to-d4sign", step: action, error: errorMsg },
          performed_by: user.id,
        });
      }
    } catch (err) {
      errorMsg = sanitizeError(err);
      await supabase.from("verba_indenizatoria_documents").update({
        d4sign_status: "error",
        d4sign_error_message: `${action}: ${errorMsg}`,
      }).eq("id", doc.id).then(() => {});
    }

    // Contar documentos ainda pendentes (inclui os em etapas intermediárias)
    const { count: pendingCount } = await supabase
      .from("verba_indenizatoria_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("d4sign_status", ["draft", "uploaded", "signers_added"])
      .not("generated_file_path", "is", null);

    const sent = success && newStatus === "sent_to_sign" ? 1 : 0;
    const advanced = success ? 1 : 0;
    const errors = errorMsg ? 1 : 0;

    console.log(`[send-drafts] ${doc.employee_name}: ${action} → ${success ? newStatus : "error"} | pending: ${pendingCount}`);

    return new Response(
      JSON.stringify({
        ok: true,
        sent,        // 1 se completou todas as etapas (sent_to_sign)
        advanced,    // 1 se avançou para próxima etapa
        errors,
        action,
        status: success ? newStatus : "error",
        name: doc.employee_name,
        pending: pendingCount ?? 0,
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
