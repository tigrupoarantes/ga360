import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

// Substitui caracteres acentuados para compatibilidade com Helvetica (WinAnsiEncoding)
function sanitize(text: string): string {
  const map: Record<string, string> = {
    "á": "a", "à": "a", "â": "a", "ã": "a", "ä": "a",
    "é": "e", "è": "e", "ê": "e", "ë": "e",
    "í": "i", "ì": "i", "î": "i", "ï": "i",
    "ó": "o", "ò": "o", "ô": "o", "õ": "o", "ö": "o",
    "ú": "u", "ù": "u", "û": "u", "ü": "u",
    "ç": "c", "ñ": "n",
    "Á": "A", "À": "A", "Â": "A", "Ã": "A", "Ä": "A",
    "É": "E", "È": "E", "Ê": "E", "Ë": "E",
    "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
    "Ó": "O", "Ò": "O", "Ô": "O", "Õ": "O", "Ö": "O",
    "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
    "Ç": "C", "Ñ": "N",
  };
  return text.replace(/[^\x00-\x7F]/g, (char) => map[char] ?? "?");
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompetencia(competencia: string): string {
  const [year, month] = competencia.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(month, 10) - 1]}/${year}`;
}

function replacePlaceholders(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

interface GenerateRequest {
  companyId: string;
  employeeCpf: string;
  competencia: string;   // "2026-03"
  templateId: string;
  sendToSign?: boolean;
  signerEmail?: string;  // se diferente do employee_email no Datalake
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

    const body = (await req.json()) as GenerateRequest;
    const { companyId, employeeCpf, competencia, templateId, sendToSign, signerEmail } = body;

    if (!companyId || !employeeCpf || !competencia || !templateId) {
      return new Response(
        JSON.stringify({ error: "companyId, employeeCpf, competencia e templateId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Buscar template
    const { data: template, error: tplError } = await supabase
      .from("d4sign_document_templates")
      .select("*")
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle();

    if (tplError || !template) {
      return new Response(JSON.stringify({ error: "Template não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Buscar dados do funcionário no Datalake (via verbas-secure-query)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const [ano, mesStr] = competencia.split("-");
    const mes = parseInt(mesStr, 10);

    const verbasResp = await fetch(`${supabaseUrl}/functions/v1/verbas-secure-query`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId,
        cpf: employeeCpf,
        ano: parseInt(ano, 10),
        mes,
        pageSize: 10,
      }),
    });

    if (!verbasResp.ok) {
      const errData = await verbasResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: "Falha ao buscar dados do Datalake", details: errData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const verbasData = await verbasResp.json();
    const rows: Record<string, unknown>[] = verbasData.rows ?? [];

    // Encontrar VERBA_INDENIZATORIA e ADIANTAMENTO
    const verbaRow = rows.find((r) =>
      String(r.tipo_verba || "").toUpperCase().includes("INDENIZ") ||
      String(r.tipo_evento || "").toUpperCase().includes("INDENIZ")
    ) ?? rows[0];

    if (!verbaRow) {
      return new Response(
        JSON.stringify({ error: "Nenhuma verba encontrada para este funcionário/competência" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const valorVerba = Number(verbaRow.valor_verba ?? verbaRow.valor ?? 0);
    const valorAdiantamento = Number(verbaRow.valor_adiantamento ?? 0);
    const valorTotal = valorVerba + valorAdiantamento;

    const employeeName = String(verbaRow.nome_funcionario ?? verbaRow.nome ?? "");
    const employeeEmail = signerEmail || String(verbaRow.email ?? "");
    const empresa = String(verbaRow.razao_social ?? verbaRow.empresa ?? "");
    const departamento = String(verbaRow.departamento ?? "");
    const cargo = String(verbaRow.cargo ?? "");
    const unidade = String(verbaRow.unidade ?? "");
    const grupoContabilizacao = String(verbaRow.grupo_contabilizacao ?? "");

    const hoje = new Date();
    const dataGeracao = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;

    const placeholders: Record<string, string> = {
      nome_funcionario: employeeName,
      cpf: employeeCpf,
      empresa,
      departamento,
      cargo,
      unidade,
      competencia: formatCompetencia(competencia),
      valor_verba: formatBRL(valorVerba),
      valor_adiantamento: formatBRL(valorAdiantamento),
      valor_total: formatBRL(valorTotal),
      data_geracao: dataGeracao,
      grupo_contabilizacao: grupoContabilizacao,
    };

    // 3. Gerar PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const blue = rgb(0.067, 0.38, 0.647);
    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);
    const lightGray = rgb(0.95, 0.95, 0.95);

    // Header
    page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: blue });
    page.drawText(sanitize("TERMO DE VERBA INDENIZATORIA"), {
      x: 40,
      y: height - 42,
      size: 18,
      font: fontBold,
      color: white,
    });
    page.drawText(sanitize(`Competencia: ${formatCompetencia(competencia)}`), {
      x: 40,
      y: height - 60,
      size: 10,
      font: fontReg,
      color: white,
    });

    let y = height - 100;

    function drawSection(title: string) {
      page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: lightGray });
      page.drawText(sanitize(title), { x: 45, y, size: 10, font: fontBold, color: blue });
      y -= 26;
    }

    function drawRow(label: string, value: string) {
      page.drawText(sanitize(`${label}:`), { x: 45, y, size: 9, font: fontBold, color: black });
      page.drawText(sanitize(value), { x: 200, y, size: 9, font: fontReg, color: black });
      y -= 18;
    }

    // Se o template tem HTML, usar conteúdo simples do HTML como texto estruturado
    // Caso contrário, gerar layout padrão
    if (template.template_html) {
      const filled = replacePlaceholders(template.template_html, placeholders);
      // Extrair texto limpo do HTML (remoção de tags)
      const plainText = filled.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      drawSection("Dados do Documento");
      // Quebrar o texto em linhas
      const words = sanitize(plainText).split(" ");
      let line = "";
      const maxWidth = width - 90;
      const charWidth = 5.5; // estimativa para 9pt

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (testLine.length * charWidth > maxWidth) {
          if (y < 80) break;
          page.drawText(line, { x: 45, y, size: 9, font: fontReg, color: black });
          y -= 14;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line && y >= 80) {
        page.drawText(line, { x: 45, y, size: 9, font: fontReg, color: black });
        y -= 14;
      }
    } else {
      // Layout padrão
      drawSection("Dados do Funcionario");
      drawRow("Nome", employeeName);
      drawRow("CPF", employeeCpf);
      drawRow("Empresa", empresa);
      drawRow("Departamento", departamento);
      drawRow("Cargo", cargo);
      drawRow("Unidade", unidade);
      if (grupoContabilizacao) drawRow("Grupo Contab.", grupoContabilizacao);

      y -= 10;
      drawSection("Dados Financeiros");
      drawRow("Competencia", formatCompetencia(competencia));
      drawRow("Verba Indenizatoria", formatBRL(valorVerba));
      if (valorAdiantamento > 0) drawRow("Adiantamento", formatBRL(valorAdiantamento));
    }

    // Caixa de valor total
    y -= 10;
    page.drawRectangle({ x: 40, y: y - 10, width: width - 80, height: 36, color: blue });
    page.drawText("VALOR TOTAL:", { x: 50, y: y + 8, size: 11, font: fontBold, color: white });
    page.drawText(sanitize(formatBRL(valorTotal)), {
      x: 200,
      y: y + 8,
      size: 14,
      font: fontBold,
      color: white,
    });
    y -= 50;

    // Assinatura
    y = Math.min(y, 180);
    page.drawLine({ start: { x: 40, y: 80 }, end: { x: 240, y: 80 }, thickness: 1, color: black });
    page.drawText(sanitize(employeeName || "Funcionario"), { x: 40, y: 65, size: 8, font: fontReg, color: black });
    page.drawText(sanitize(`CPF: ${employeeCpf}`), { x: 40, y: 55, size: 8, font: fontReg, color: black });

    page.drawLine({ start: { x: 340, y: 80 }, end: { x: 555, y: 80 }, thickness: 1, color: black });
    page.drawText(sanitize("Responsavel RH"), { x: 340, y: 65, size: 8, font: fontReg, color: black });

    // Footer
    page.drawText(sanitize(`Gerado em: ${dataGeracao} | GA360 - Gestao de Pessoas`), {
      x: 40,
      y: 30,
      size: 7,
      font: fontReg,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();

    // 4. Upload para Storage
    const timestamp = Date.now();
    const storagePath = `${companyId}/generated/${competencia}/${employeeCpf}_${timestamp}.pdf`;

    const { error: storageError } = await supabase.storage
      .from("verbas-indenizatorias")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (storageError) {
      return new Response(
        JSON.stringify({ error: "Falha ao salvar PDF no Storage", details: storageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Criar registro em verba_indenizatoria_documents
    const { data: docRecord, error: insertError } = await supabase
      .from("verba_indenizatoria_documents")
      .insert({
        company_id: companyId,
        template_id: templateId,
        employee_name: employeeName,
        employee_cpf: employeeCpf,
        employee_email: employeeEmail || null,
        employee_department: departamento || null,
        employee_position: cargo || null,
        employee_unit: unidade || null,
        employee_accounting_group: grupoContabilizacao || null,
        competencia,
        ano: parseInt(ano, 10),
        mes,
        valor_verba: valorVerba,
        valor_adiantamento: valorAdiantamento,
        payload_json: verbaRow,
        d4sign_status: "draft",
        generated_file_path: storagePath,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !docRecord) {
      return new Response(
        JSON.stringify({ error: "Falha ao criar registro do documento", details: insertError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Log de criação
    await supabase.from("verba_indenizatoria_logs").insert({
      document_id: docRecord.id,
      action: "created",
      details: { storagePath, competencia, cpf: employeeCpf },
      performed_by: user.id,
    });

    // 7. Se sendToSign, enviar para D4Sign
    if (sendToSign) {
      // Obter config D4Sign
      const { data: d4config } = await supabase
        .from("d4sign_config")
        .select("safe_id, base_url")
        .is("company_id", null)   // config global (sem vínculo a empresa)
        .eq("is_active", true)
        .maybeSingle();

      if (d4config?.safe_id) {
        try {
          const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
          const fileName = `verba_${sanitize(employeeName).replace(/\s+/g, "_")}_${competencia}.pdf`;

          // Upload para D4Sign
          const uploadResp = await fetch(`${supabaseUrl}/functions/v1/d4sign-proxy`, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "upload_document",
              companyId,
              payload: { fileBase64: pdfBase64, fileName, name: fileName },
            }),
          });

          const uploadResult = await uploadResp.json();

          if (uploadResp.ok && uploadResult.ok) {
            const d4signDocUuid = uploadResult.data?.uuid || uploadResult.data?.document?.uuid;

            if (d4signDocUuid) {
              // Registrar webhook
              const webhookUrl = Deno.env.get("D4SIGN_WEBHOOK_URL") ||
                `${supabaseUrl}/functions/v1/d4sign-webhook`;

              await fetch(`${supabaseUrl}/functions/v1/d4sign-proxy`, {
                method: "POST",
                headers: { Authorization: authHeader, "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "register_webhook",
                  companyId,
                  payload: { documentUuid: d4signDocUuid, webhookUrl },
                }),
              });

              // Adicionar signatário
              const signerEmailToUse = employeeEmail || signerEmail;
              if (signerEmailToUse) {
                await fetch(`${supabaseUrl}/functions/v1/d4sign-proxy`, {
                  method: "POST",
                  headers: { Authorization: authHeader, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "add_signer",
                    companyId,
                    payload: {
                      documentUuid: d4signDocUuid,
                      signers: [{ email: signerEmailToUse, act: "1" }],
                    },
                  }),
                });
              }

              // Enviar para assinatura
              await fetch(`${supabaseUrl}/functions/v1/d4sign-proxy`, {
                method: "POST",
                headers: { Authorization: authHeader, "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "send_to_sign",
                  companyId,
                  payload: {
                    documentUuid: d4signDocUuid,
                    message: `Por favor, assine o documento de Verba Indenizatoria referente a competencia ${formatCompetencia(competencia)}.`,
                  },
                }),
              });

              // Atualizar registro
              await supabase
                .from("verba_indenizatoria_documents")
                .update({
                  d4sign_document_uuid: d4signDocUuid,
                  d4sign_safe_uuid: d4config.safe_id,
                  d4sign_status: "sent_to_sign",
                  d4sign_signer_email: employeeEmail || signerEmail || null,
                  d4sign_sent_at: new Date().toISOString(),
                })
                .eq("id", docRecord.id);

              await supabase.from("verba_indenizatoria_logs").insert({
                document_id: docRecord.id,
                action: "sent_to_sign",
                details: { d4sign_uuid: d4signDocUuid },
                performed_by: user.id,
              });
            }
          }
        } catch (sendErr) {
          console.error("generate-verba-doc: erro ao enviar para D4Sign:", sanitizeError(sendErr));
          // Não falhar — documento foi gerado com sucesso
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        documentId: docRecord.id,
        storagePath,
        status: sendToSign ? "sent_to_sign" : "draft",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
