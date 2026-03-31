import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Envia documentos draft/error para D4Sign com throttling.
// Usa service_role direto — não depende de JWT do usuário.

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

function formatCompetencia(competencia: string): string {
  const [year, month] = competencia.split("-");
  const months = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[parseInt(month, 10) - 1]}/${year}`;
}

interface SendRequest {
  companyId: string;
  delayMs?: number; // delay entre cada envio (default: 2000ms)
  limit?: number;   // máximo de documentos a enviar (default: todos)
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth: verificar usuário
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
    const { companyId, delayMs = 2000, limit } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Service role para todas as operações D4Sign
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar config D4Sign
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

    async function callD4Sign(url: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
      const headers: Record<string, string> = { Accept: "application/json" };
      let fetchBody: BodyInit | undefined;
      if (body instanceof FormData) {
        fetchBody = body;
      } else if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        fetchBody = JSON.stringify(body);
      }
      const resp = await fetch(url, { method, headers, body: fetchBody });
      const text = await resp.text();
      let data: unknown;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      return { ok: resp.ok, status: resp.status, data };
    }

    // Buscar documentos draft + error
    let query = supabase
      .from("verba_indenizatoria_documents")
      .select("id, employee_name, employee_cpf, employee_email, competencia, generated_file_path, d4sign_status, d4sign_signer_email")
      .eq("company_id", companyId)
      .in("d4sign_status", ["draft", "error"])
      .not("generated_file_path", "is", null)
      .order("employee_name");

    if (limit) query = query.limit(limit);

    const { data: docs, error: queryError } = await query;

    if (queryError || !docs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Nenhum documento pendente" }), {
        status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = Deno.env.get("D4SIGN_WEBHOOK_URL") || `${supabaseUrl}/functions/v1/d4sign-webhook`;
    const webhookSecret = Deno.env.get("D4SIGN_WEBHOOK_SECRET");

    const results: Array<{ name: string; cpf: string; status: string; error?: string }> = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];

      // Throttle: delay entre envios (exceto o primeiro)
      if (i > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }

      try {
        // 1. Download do PDF do Storage
        const { data: pdfData, error: dlError } = await supabase.storage
          .from("verbas-indenizatorias")
          .download(doc.generated_file_path);

        if (dlError || !pdfData) {
          results.push({ name: doc.employee_name, cpf: doc.employee_cpf, status: "error", error: "PDF não encontrado no Storage" });
          continue;
        }

        const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
        const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
        const fileName = `verba_${sanitize(doc.employee_name).replace(/\s+/g, "_")}_${doc.competencia}.pdf`;

        // 2. Upload para D4Sign
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const formData = new FormData();
        formData.append("file", blob, fileName);
        formData.append("name", fileName);

        const uploadUrl = buildUrl(`documents/${d4config.safe_id}/upload`);
        const uploadResult = await callD4Sign(uploadUrl, "POST", formData);

        if (!uploadResult.ok) {
          const errMsg = JSON.stringify(uploadResult.data).slice(0, 200);
          await supabase.from("verba_indenizatoria_documents").update({ d4sign_status: "error", d4sign_error_message: `upload: ${errMsg}` }).eq("id", doc.id);
          results.push({ name: doc.employee_name, cpf: doc.employee_cpf, status: "error", error: `upload D4Sign: ${errMsg}` });
          continue;
        }

        const d4data = uploadResult.data as Record<string, unknown>;
        const d4signDocUuid = (d4data?.uuid as string) || ((d4data?.document as Record<string, unknown>)?.uuid as string);

        if (!d4signDocUuid) {
          await supabase.from("verba_indenizatoria_documents").update({ d4sign_status: "error", d4sign_error_message: "upload ok mas uuid não retornado" }).eq("id", doc.id);
          results.push({ name: doc.employee_name, cpf: doc.employee_cpf, status: "error", error: "uuid não retornado" });
          continue;
        }

        // 3. Registrar webhook
        const webhookBody: Record<string, string> = { url: webhookUrl };
        if (webhookSecret) webhookBody.token = webhookSecret;
        await callD4Sign(buildUrl(`documents/${d4signDocUuid}/webhooks`), "POST", webhookBody);

        // 4. Adicionar signatário
        const signerEmail = doc.employee_email || doc.d4sign_signer_email;
        let signerAdded = false;

        if (signerEmail) {
          const addSignerResult = await callD4Sign(
            buildUrl(`documents/${d4signDocUuid}/createlist`),
            "POST",
            { signers: [{ email: signerEmail, act: "1", foreign: "0", foreignLang: "" }] },
          );
          signerAdded = addSignerResult.ok;

          if (!signerAdded) {
            const errMsg = JSON.stringify(addSignerResult.data).slice(0, 200);
            await supabase.from("verba_indenizatoria_logs").insert({
              document_id: doc.id, action: "error",
              details: { step: "add_signer", email: signerEmail, response: addSignerResult.data },
              performed_by: user.id,
            });
          }
        }

        // 5. Enviar para assinatura (com delay para D4Sign processar)
        let sentToSign = false;
        if (signerAdded) {
          await new Promise(r => setTimeout(r, 2000)); // D4Sign precisa processar

          const sendResult = await callD4Sign(
            buildUrl(`documents/${d4signDocUuid}/sendtosigner`),
            "POST",
            {},
          );
          sentToSign = sendResult.ok;
        }

        // 6. Atualizar registro
        const finalStatus = sentToSign ? "sent_to_sign" : signerAdded ? "error" : "error";
        await supabase.from("verba_indenizatoria_documents").update({
          d4sign_document_uuid: d4signDocUuid,
          d4sign_safe_uuid: d4config.safe_id,
          d4sign_status: finalStatus,
          d4sign_signer_email: signerEmail || null,
          d4sign_sent_at: sentToSign ? new Date().toISOString() : null,
          d4sign_error_message: !sentToSign ? `signer: ${signerAdded ? "ok" : "falhou"}, send: ${sentToSign ? "ok" : "falhou"}` : null,
        }).eq("id", doc.id);

        await supabase.from("verba_indenizatoria_logs").insert({
          document_id: doc.id,
          action: sentToSign ? "sent_to_sign" : "error",
          details: { source: "send-drafts-to-d4sign", d4sign_uuid: d4signDocUuid, signer: signerEmail, sent: sentToSign },
          performed_by: user.id,
        });

        results.push({ name: doc.employee_name, cpf: doc.employee_cpf, status: finalStatus });
        console.log(`[send-drafts] ${i + 1}/${docs.length} ${doc.employee_name}: ${finalStatus}`);
      } catch (err) {
        results.push({ name: doc.employee_name, cpf: doc.employee_cpf, status: "error", error: sanitizeError(err) });
      }
    }

    const sent = results.filter(r => r.status === "sent_to_sign").length;
    const errors = results.filter(r => r.status === "error").length;

    return new Response(
      JSON.stringify({ ok: true, sent, errors, total: results.length, results }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
