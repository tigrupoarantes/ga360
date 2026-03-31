import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobWriter, ZipReader } from "https://deno.land/x/zipjs/index.js";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Webhook público da D4Sign — sem auth Bearer
// Valida por token secreto no header X-D4Sign-Token

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

// type_post da D4Sign:
// "1" = documento finalizado (todos assinaram)
// "2" = documento cancelado
// "3" = assinatura parcial (um signatário assinou)
// "4" = e-mail não entregue

interface D4SignWebhookPayload {
  uuid: string;         // UUID do documento na D4Sign
  type_post: string;
  message?: string;
  name_signatary?: string;
  email_signatary?: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validar token secreto (OBRIGATÓRIO — rejeitar se não configurado)
    const webhookSecret = Deno.env.get("D4SIGN_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("[d4sign-webhook] D4SIGN_WEBHOOK_SECRET não configurado — rejeitando request");
      return new Response(JSON.stringify({ error: "webhook not configured" }), {
        status: 503,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Aceitar token apenas via header (nunca query param)
    const receivedToken = req.headers.get("x-d4sign-token") || "";
    // Timing-safe comparison para evitar timing attacks
    const encoder = new TextEncoder();
    const a = encoder.encode(receivedToken);
    const b = encoder.encode(webhookSecret);
    if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as D4SignWebhookPayload;
    const { uuid: d4signDocumentUuid, type_post } = payload;

    if (!d4signDocumentUuid) {
      return new Response(JSON.stringify({ error: "uuid required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Buscar documento no banco
    const { data: doc, error: docError } = await supabase
      .from("verba_indenizatoria_documents")
      .select("id, company_id, employee_cpf, competencia, d4sign_status")
      .eq("d4sign_document_uuid", d4signDocumentUuid)
      .maybeSingle();

    if (docError || !doc) {
      // Documento não encontrado — pode ser de outro sistema; retornar 200 para não causar retry
      console.warn("d4sign-webhook: documento não encontrado para uuid", d4signDocumentUuid);
      return new Response(JSON.stringify({ ok: true, warn: "document_not_found" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    let newStatus: string = doc.d4sign_status;
    let extraFields: Record<string, unknown> = {};
    let logAction: string = "webhook_received";

    if (type_post === "1") {
      // Documento finalizado — todos assinaram
      newStatus = "signed";
      extraFields = { d4sign_signed_at: now };
      logAction = "signed";

      // Fazer download do documento assinado direto da D4Sign e salvar no Storage
      try {
        // Buscar credenciais D4Sign
        const { data: d4config } = await supabase
          .from("d4sign_config")
          .select("token_api, crypt_key, base_url")
          .is("company_id", null)
          .eq("is_active", true)
          .maybeSingle();

        if (d4config?.token_api && d4config?.crypt_key) {
          const baseUrl = d4config.base_url.replace(/\/+$/, "");
          const downloadUrl = new URL(`${baseUrl}/documents/${d4signDocumentUuid}/download`);
          downloadUrl.searchParams.set("tokenAPI", d4config.token_api);
          downloadUrl.searchParams.set("cryptKey", d4config.crypt_key);

          const downloadResp = await fetch(downloadUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ type: 0 }),
          });

          if (downloadResp.ok) {
            const downloadText = await downloadResp.text();
            console.log("[d4sign-webhook] download response preview:", downloadText.slice(0, 500));

            let downloadResult: Record<string, unknown> = {};
            try { downloadResult = JSON.parse(downloadText); } catch { downloadResult = { raw: downloadText.slice(0, 200) }; }

            // D4Sign pode retornar em diferentes formatos
            const fileUrl: string | undefined =
              (downloadResult?.url as string) ||
              (downloadResult?.link as string) ||
              (downloadResult?.data as Record<string, unknown>)?.url as string ||
              (Array.isArray(downloadResult) ? (downloadResult[0] as Record<string, unknown>)?.url as string : undefined);

            console.log("[d4sign-webhook] fileUrl extraída:", fileUrl);

            if (fileUrl) {
              const fileResp = await fetch(fileUrl);
              const contentType = fileResp.headers.get("content-type") || "";
              console.log("[d4sign-webhook] file download status:", fileResp.status, "content-type:", contentType, "size:", fileResp.headers.get("content-length"));

              if (fileResp.ok && fileResp.body) {
                const tmpId = crypto.randomUUID();
                const downloadPath = `/tmp/${tmpId}_download`;
                const storagePath = `${doc.company_id}/signed/${doc.competencia}/${doc.employee_cpf}_signed.pdf`;

                // Salvar arquivo no /tmp (ephemeral storage) — evita corrupção em memória
                await Deno.writeFile(downloadPath, fileResp.body);
                const fileInfo = await Deno.stat(downloadPath);
                console.log("[d4sign-webhook] file saved to /tmp, size:", fileInfo.size);

                // Ler magic bytes para detectar formato
                const headerFile = await Deno.open(downloadPath, { read: true });
                const header = new Uint8Array(4);
                await headerFile.read(header);
                headerFile.close();

                const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
                const isZip = header[0] === 0x50 && header[1] === 0x4B; // PK
                console.log("[d4sign-webhook] format:", isPdf ? "PDF" : isZip ? "ZIP" : "UNKNOWN",
                  "magic:", Array.from(header).map(b => b.toString(16).padStart(2, "0")).join(" "));

                let uploadBlob: Blob;

                if (isZip) {
                  // Abrir ZIP via ReadableStream (padrão recomendado pelo Supabase)
                  const file = await Deno.open(downloadPath, { read: true });
                  const zipReader = new ZipReader(file.readable);
                  const entries = await zipReader.getEntries();

                  console.log("[d4sign-webhook] ZIP entries:", entries.map((e: any) => `${e.filename} (${e.uncompressedSize}b)`));

                  const pdfEntry = entries.find((e: any) =>
                    e.filename.toLowerCase().endsWith(".pdf") && !e.directory);

                  if (!pdfEntry || !pdfEntry.getData) {
                    await zipReader.close();
                    throw new Error(`ZIP não contém .pdf. Entries: ${entries.map((e: any) => e.filename).join(", ")}`);
                  }

                  const blobWriter = new BlobWriter("application/pdf");
                  uploadBlob = await pdfEntry.getData(blobWriter);
                  await zipReader.close();

                  console.log("[d4sign-webhook] PDF extraído do ZIP:", pdfEntry.filename, "size:", uploadBlob.size);

                  // Validar que o conteúdo extraído é realmente um PDF
                  const pdfHeader = new Uint8Array(await uploadBlob.slice(0, 4).arrayBuffer());
                  if (pdfHeader[0] !== 0x25 || pdfHeader[1] !== 0x50 || pdfHeader[2] !== 0x44 || pdfHeader[3] !== 0x46) {
                    throw new Error(`Conteúdo extraído não é PDF válido. Header: ${Array.from(pdfHeader).map(b => b.toString(16)).join(" ")}`);
                  }
                  console.log("[d4sign-webhook] PDF validado com sucesso (magic bytes %PDF OK)");
                } else if (isPdf) {
                  // Já é PDF — ler do /tmp como Blob
                  const pdfBytes = await Deno.readFile(downloadPath);
                  uploadBlob = new Blob([pdfBytes], { type: "application/pdf" });
                  console.log("[d4sign-webhook] arquivo já é PDF, size:", uploadBlob.size);
                } else {
                  throw new Error(`Formato desconhecido. Magic bytes: ${Array.from(header).map(b => b.toString(16)).join(" ")}`);
                }

                // Cleanup /tmp
                try { await Deno.remove(downloadPath); } catch { /* ignore */ }

                // Deletar arquivo antigo se existir (evitar corrupção por upsert)
                await supabase.storage.from("verbas-indenizatorias").remove([storagePath]);

                // Upload como Blob direto (recomendado pela doc do Supabase)
                const { error: uploadError } = await supabase.storage
                  .from("verbas-indenizatorias")
                  .upload(storagePath, uploadBlob, {
                    contentType: "application/pdf",
                  });

                if (uploadError) {
                  console.error("[d4sign-webhook] Erro no upload Storage:", uploadError.message);
                } else {
                  extraFields.signed_file_path = storagePath;
                  console.log("[d4sign-webhook] PDF assinado salvo em", storagePath, "size:", uploadBlob.size);
                }
              } else {
                console.error("[d4sign-webhook] download do PDF falhou:", fileResp.status);
              }
            } else {
              console.warn("[d4sign-webhook] D4Sign download não retornou URL:", JSON.stringify(downloadResult).slice(0, 300));
            }
          } else {
            console.error("[d4sign-webhook] D4Sign download endpoint retornou:", downloadResp.status);
          }
        } else {
          console.warn("d4sign-webhook: d4sign_config não encontrada para download");
        }
      } catch (downloadErr) {
        const errMsg = sanitizeError(downloadErr);
        console.error("[d4sign-webhook] erro ao processar doc assinado:", errMsg);
        // Logar erro no banco para diagnóstico
        await supabase.from("verba_indenizatoria_logs").insert({
          document_id: doc.id,
          action: "error",
          details: {
            step: "download_signed_pdf",
            error: errMsg,
            d4sign_uuid: d4signDocumentUuid,
          },
        });
      }
    } else if (type_post === "2") {
      // Documento cancelado
      newStatus = "cancelled";
      extraFields = { d4sign_cancelled_at: now };
      logAction = "cancelled";
    } else if (type_post === "3") {
      // Assinatura parcial
      newStatus = "waiting_signature";
      logAction = "partial_signature";
    } else if (type_post === "4") {
      // E-mail não entregue
      logAction = "email_bounced";
    }

    // Atualizar documento
    if (newStatus !== doc.d4sign_status || Object.keys(extraFields).length > 0) {
      await supabase
        .from("verba_indenizatoria_documents")
        .update({ d4sign_status: newStatus, updated_at: now, ...extraFields })
        .eq("id", doc.id);
    }

    // Registrar log
    await supabase.from("verba_indenizatoria_logs").insert({
      document_id: doc.id,
      action: logAction,
      details: {
        type_post,
        d4sign_uuid: d4signDocumentUuid,
        message: payload.message,
        signatary_email: payload.email_signatary,
        signatary_name: payload.name_signatary,
        new_status: newStatus,
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
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
