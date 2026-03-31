import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobWriter, ZipReader } from "https://deno.land/x/zipjs/index.js";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Sincroniza status dos documentos D4Sign que estão pendentes no GA360.
// Polling direto na API D4Sign — não depende de webhook.

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

interface SyncRequest {
  companyId: string;
  documentId?: string; // se informado, sincroniza só esse documento
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

    const body = (await req.json()) as SyncRequest;
    const { companyId, documentId } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar config D4Sign
    const { data: d4config } = await supabase
      .from("d4sign_config")
      .select("token_api, crypt_key, base_url")
      .is("company_id", null)
      .eq("is_active", true)
      .maybeSingle();

    if (!d4config?.token_api || !d4config?.crypt_key) {
      return new Response(JSON.stringify({ error: "D4Sign não configurado" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Buscar documentos pendentes
    let query = supabase
      .from("verba_indenizatoria_documents")
      .select("id, company_id, employee_cpf, competencia, d4sign_document_uuid, d4sign_status")
      .eq("company_id", companyId)
      .not("d4sign_document_uuid", "is", null)
      .in("d4sign_status", ["sent_to_sign", "waiting_signature"]);

    if (documentId) {
      query = query.eq("id", documentId);
    }

    const { data: pendingDocs, error: queryError } = await query;

    if (queryError) {
      return new Response(JSON.stringify({ error: "Falha ao buscar documentos", details: queryError.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "Nenhum documento pendente" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const baseUrl = d4config.base_url.replace(/\/+$/, "");
    const results: Array<{ id: string; uuid: string; oldStatus: string; newStatus: string; error?: string }> = [];

    for (const doc of pendingDocs) {
      try {
        // Consultar status na D4Sign
        const docUrl = new URL(`${baseUrl}/documents/${doc.d4sign_document_uuid}`);
        docUrl.searchParams.set("tokenAPI", d4config.token_api);
        docUrl.searchParams.set("cryptKey", d4config.crypt_key);

        const resp = await fetch(docUrl.toString(), { method: "GET", headers: { Accept: "application/json" } });

        if (!resp.ok) {
          results.push({ id: doc.id, uuid: doc.d4sign_document_uuid, oldStatus: doc.d4sign_status, newStatus: doc.d4sign_status, error: `D4Sign HTTP ${resp.status}` });
          continue;
        }

        const d4data = await resp.json();
        // D4Sign retorna array com 1 elemento ou objeto direto
        const d4doc = Array.isArray(d4data) ? d4data[0] : d4data;

        if (!d4doc) {
          results.push({ id: doc.id, uuid: doc.d4sign_document_uuid, oldStatus: doc.d4sign_status, newStatus: doc.d4sign_status, error: "documento não encontrado na D4Sign" });
          continue;
        }

        // Mapear status D4Sign para GA360
        // D4Sign statusId: "1" = Processando, "2" = Aguardando, "3" = Assinado, "4" = Cancelado, "5" = Finalizado
        const d4status = String(d4doc.statusId || d4doc.status_id || "");
        const d4statusName = String(d4doc.statusName || d4doc.status_name || "").toLowerCase();

        console.log(`[sync-d4sign] doc ${doc.id}: D4Sign statusId=${d4status}, statusName=${d4statusName}`);

        let newStatus = doc.d4sign_status;
        const now = new Date().toISOString();
        const extraFields: Record<string, unknown> = {};

        if (d4status === "3" || d4status === "5" || d4statusName.includes("finalizado") || d4statusName.includes("assinado") || d4statusName.includes("completed") || d4statusName.includes("signed")) {
          newStatus = "signed";
          extraFields.d4sign_signed_at = now;

          // Download do PDF assinado
          try {
            const downloadUrl = new URL(`${baseUrl}/documents/${doc.d4sign_document_uuid}/download`);
            downloadUrl.searchParams.set("tokenAPI", d4config.token_api);
            downloadUrl.searchParams.set("cryptKey", d4config.crypt_key);

            const downloadResp = await fetch(downloadUrl.toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ type: 0 }),
            });

            if (downloadResp.ok) {
              const downloadText = await downloadResp.text();
              let downloadResult: Record<string, unknown> = {};
              try { downloadResult = JSON.parse(downloadText); } catch { /* ignore */ }

              const fileUrl: string | undefined =
                (downloadResult?.url as string) ||
                (downloadResult?.link as string) ||
                (downloadResult?.data as Record<string, unknown>)?.url as string ||
                (Array.isArray(downloadResult) ? (downloadResult[0] as Record<string, unknown>)?.url as string : undefined);

              if (fileUrl) {
                const fileResp = await fetch(fileUrl);
                if (fileResp.ok && fileResp.body) {
                  const storagePath = `${doc.company_id}/signed/${doc.competencia}/${doc.employee_cpf}_signed.pdf`;
                  const tmpId = crypto.randomUUID();
                  const downloadPath = `/tmp/${tmpId}_download`;

                  await Deno.writeFile(downloadPath, fileResp.body);

                  // Detectar formato (PDF ou ZIP)
                  const headerFile = await Deno.open(downloadPath, { read: true });
                  const header = new Uint8Array(4);
                  await headerFile.read(header);
                  headerFile.close();

                  const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
                  const isZip = header[0] === 0x50 && header[1] === 0x4B;

                  let uploadBlob: Blob;

                  if (isZip) {
                    const file = await Deno.open(downloadPath, { read: true });
                    const zipReader = new ZipReader(file.readable);
                    const entries = await zipReader.getEntries();
                    const pdfEntry = entries.find((e: any) => e.filename.toLowerCase().endsWith(".pdf") && !e.directory);

                    if (pdfEntry?.getData) {
                      const blobWriter = new BlobWriter("application/pdf");
                      uploadBlob = await pdfEntry.getData(blobWriter);
                    } else {
                      uploadBlob = new Blob([await Deno.readFile(downloadPath)], { type: "application/pdf" });
                    }
                    await zipReader.close();
                  } else {
                    uploadBlob = new Blob([await Deno.readFile(downloadPath)], { type: "application/pdf" });
                  }

                  try { await Deno.remove(downloadPath); } catch { /* ignore */ }

                  await supabase.storage.from("verbas-indenizatorias").remove([storagePath]);
                  const { error: uploadError } = await supabase.storage
                    .from("verbas-indenizatorias")
                    .upload(storagePath, uploadBlob, { contentType: "application/pdf" });

                  if (!uploadError) {
                    extraFields.signed_file_path = storagePath;
                    console.log(`[sync-d4sign] PDF assinado salvo: ${storagePath}`);
                  }
                }
              }
            }
          } catch (dlErr) {
            console.error(`[sync-d4sign] erro download PDF:`, sanitizeError(dlErr));
          }
        } else if (d4status === "4" || d4statusName.includes("cancelado") || d4statusName.includes("cancelled")) {
          newStatus = "cancelled";
          extraFields.d4sign_cancelled_at = now;
        }

        // Atualizar se mudou
        if (newStatus !== doc.d4sign_status) {
          await supabase
            .from("verba_indenizatoria_documents")
            .update({ d4sign_status: newStatus, updated_at: now, ...extraFields })
            .eq("id", doc.id);

          await supabase.from("verba_indenizatoria_logs").insert({
            document_id: doc.id,
            action: newStatus === "signed" ? "signed" : newStatus === "cancelled" ? "cancelled" : "sync_status",
            details: {
              source: "sync-d4sign-status",
              d4sign_statusId: d4status,
              d4sign_statusName: d4statusName,
              previous_status: doc.d4sign_status,
            },
            performed_by: user.id,
          });
        }

        results.push({ id: doc.id, uuid: doc.d4sign_document_uuid, oldStatus: doc.d4sign_status, newStatus });
      } catch (err) {
        results.push({ id: doc.id, uuid: doc.d4sign_document_uuid, oldStatus: doc.d4sign_status, newStatus: doc.d4sign_status, error: sanitizeError(err) });
      }
    }

    const synced = results.filter(r => r.oldStatus !== r.newStatus).length;

    return new Response(
      JSON.stringify({ ok: true, synced, total: results.length, results }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
