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

    // 2. Buscar dados do funcionário diretamente de payroll_verba_pivot (já sincronizado)
    const MES_MAP: Record<string, string> = {
      "01": "janeiro",  "02": "fevereiro", "03": "marco",
      "04": "abril",    "05": "maio",      "06": "junho",
      "07": "julho",    "08": "agosto",    "09": "setembro",
      "10": "outubro",  "11": "novembro",  "12": "dezembro",
    };

    const [ano, mesStr] = competencia.split("-");
    const mes = parseInt(mesStr, 10);
    const mesNome = MES_MAP[mesStr];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (!mesNome) {
      return new Response(
        JSON.stringify({ error: "Mês inválido na competência fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cpfNorm = employeeCpf.replace(/\D/g, "");

    const { data: verbaRows, error: verbaError } = await supabase
      .from("payroll_verba_pivot")
      .select(
        `cpf, nome_funcionario, tipo_verba, razao_social,
         employee_department, employee_position, employee_unidade, employee_accounting_group,
         ${mesNome}`
      )
      .eq("company_id", companyId)
      .eq("ano", parseInt(ano, 10))
      .ilike("cpf", `%${cpfNorm}%`)
      .ilike("tipo_verba", "%INDENIZ%");

    if (verbaError) {
      return new Response(
        JSON.stringify({ error: "Falha ao consultar verba", details: verbaError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Separar linha verba e linha adiantamento (rows distintos por tipo_verba)
    type PivotRow = Record<string, unknown>;
    const verbaRow = (verbaRows as PivotRow[] ?? []).find(
      (r: PivotRow) => !String(r.tipo_verba || "").toUpperCase().includes("ADIANT"),
    );
    const adiantRow = (verbaRows as PivotRow[] ?? []).find(
      (r: PivotRow) => String(r.tipo_verba || "").toUpperCase().includes("ADIANT"),
    );

    if (!verbaRow && !adiantRow) {
      return new Response(
        JSON.stringify({ error: "Nenhuma verba encontrada para este funcionário/competência" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseRow = verbaRow ?? adiantRow!;
    const valorVerba = Number((verbaRow as Record<string, unknown>)?.[mesNome] ?? 0);
    const valorAdiantamento = Number((adiantRow as Record<string, unknown>)?.[mesNome] ?? 0);
    const valorTotal = valorVerba + valorAdiantamento;

    // Buscar email do funcionário em external_employees
    const { data: empData } = await supabase
      .from("external_employees")
      .select("email")
      .ilike("cpf", `%${cpfNorm}%`)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    const employeeName = String(baseRow.nome_funcionario ?? "");
    const employeeEmail = signerEmail || empData?.email || "";
    const empresa = String(baseRow.razao_social ?? "");
    const departamento = String(baseRow.employee_department ?? "");
    const cargo = String(baseRow.employee_position ?? "");
    const unidade = String(baseRow.employee_unidade ?? "");
    const grupoContabilizacao = String(baseRow.employee_accounting_group ?? "");

    const hoje = new Date();
    const dataGeracao = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;

    // Primeiro e último dia do mês da competência
    const primeiroDia = `01/${String(mes).padStart(2, "0")}/${ano}`;
    const ultimoDia = new Date(parseInt(ano), mes, 0); // dia 0 do mês seguinte = último dia
    const ultimoDiaStr = `${String(ultimoDia.getDate()).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;

    // Data por extenso PT-BR maiúsculo (ex: "05 DE MARÇO DE 2026")
    const MESES_EXT = [
      "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
      "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
    ];
    const dataExtenso = `${String(hoje.getDate()).padStart(2, "0")} DE ${MESES_EXT[hoje.getMonth()]} DE ${hoje.getFullYear()}`;

    // 3. Gerar PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const black = rgb(0, 0, 0);

    // Margens e config
    const margin = 60;
    const textWidth = width - margin * 2;
    const fontSize = 11;
    const lineHeight = 16;
    const titleSize = 13;

    // Helper: desenha texto com word-wrap, retorna novo Y
    function drawWrappedText(text: string, startY: number, font: typeof fontReg, size: number): number {
      let y = startY;
      const words = text.split(" ");
      let line = "";
      const charW = size * 0.52; // estimativa largura média por caractere

      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length * charW > textWidth) {
          if (y < 100) break;
          page.drawText(line, { x: margin, y, size, font, color: black });
          y -= lineHeight;
          line = word;
        } else {
          line = test;
        }
      }
      if (line && y >= 100) {
        page.drawText(line, { x: margin, y, size, font, color: black });
        y -= lineHeight;
      }
      return y;
    }

    // Helper: centralizar texto
    function drawCentered(text: string, y: number, font: typeof fontReg, size: number) {
      const tw = font.widthOfTextAtSize(sanitize(text), size);
      page.drawText(sanitize(text), { x: (width - tw) / 2, y, size, font, color: black });
    }

    let y = height - 80;

    // ── Título (centralizado, bold) ──
    drawCentered("RECIBO DE QUITACAO DE DESPESAS RELATIVAS AO VEICULO DE", y, fontBold, titleSize);
    y -= lineHeight + 2;
    drawCentered("MINHA PROPRIEDADE", y, fontBold, titleSize);
    y -= lineHeight * 2.5;

    // ── Corpo do texto (texto corrido como o modelo de referência) ──
    const corpoTexto = `Eu, ${employeeName}, ${cargo || "COLABORADOR"} inscrito (a) no CPF sob o n. ${cpfNorm} venho informar que o valor de ${formatBRL(valorTotal)} depositado em minha conta bancaria e lancados em minha folha de pagamento como VERBA INDENIZATORIA no dia ${dataGeracao}, refere se ao adiantamento da verba indenizatoria para visitar 100% dos clientes do roteiro estabelecido entre os dias ${primeiroDia} A ${ultimoDiaStr}. Declaro que o valor recebido se refere aos gastos com combustivel, manutencao, depreciacao, pedagio, contratacao de seguro pessoal, ajuda no custeio com o pagamento de taxas, impostos, licenciamentos etc. e e suficiente, nao tendo desta forma nada o que reclamar.`;

    y = drawWrappedText(sanitize(corpoTexto), y, fontReg, fontSize);

    // ── Data por extenso (centralizada) ──
    y -= lineHeight * 3;
    drawCentered(dataExtenso, y, fontBold, fontSize);

    // ── Linha de assinatura (centralizada) ──
    y -= lineHeight * 4;
    const lineW = 300;
    const lineX = (width - lineW) / 2;
    page.drawLine({ start: { x: lineX, y }, end: { x: lineX + lineW, y }, thickness: 0.8, color: black });
    y -= lineHeight;
    drawCentered("Assinatura:", y, fontReg, fontSize - 1);
    y -= lineHeight;
    drawCentered(employeeName || "Funcionario", y, fontBold, fontSize);

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

              // Adicionar signatário (com validação de resposta)
              const signerEmailToUse = employeeEmail || signerEmail;
              let signerAdded = false;
              let addSignerBody: Record<string, unknown> = {};

              if (signerEmailToUse) {
                const addSignerRes = await fetch(`${supabaseUrl}/functions/v1/d4sign-proxy`, {
                  method: "POST",
                  headers: { Authorization: authHeader, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "add_signer",
                    companyId,
                    payload: {
                      documentUuid: d4signDocUuid,
                      signers: [{ email: signerEmailToUse, act: "1", foreign: "0", foreignLang: "" }],
                    },
                  }),
                });
                addSignerBody = await addSignerRes.json().catch(() => ({})) as Record<string, unknown>;
                // Considerar sucesso se HTTP 200 e resposta não contém erro explícito
                signerAdded = addSignerRes.ok && (addSignerBody?.ok !== false) && !addSignerBody?.error;
                console.log("[generate-verba-doc] add_signer resultado:", addSignerRes.status, JSON.stringify(addSignerBody));

                if (!signerAdded) {
                  console.error("[generate-verba-doc] add_signer FALHOU:", JSON.stringify(addSignerBody));
                  await supabase.from("verba_indenizatoria_logs").insert({
                    document_id: docRecord.id,
                    action: "error",
                    details: { step: "add_signer", email: signerEmailToUse, response: addSignerBody },
                    performed_by: user.id,
                  });
                }
              } else {
                console.warn("[generate-verba-doc] signerEmail vazio — add_signer não executado");
                await supabase.from("verba_indenizatoria_logs").insert({
                  document_id: docRecord.id,
                  action: "error",
                  details: { step: "add_signer", reason: "email do signatário vazio" },
                  performed_by: user.id,
                });
              }

              // Enviar para assinatura (só se signatário foi adicionado)
              // NÃO usar addpins — assinatura livre (signatário escolhe onde assinar)
              let sentToSign = false;
              let sendBody: Record<string, unknown> = {};

              if (signerAdded) {
                const sendRes = await fetch(`${supabaseUrl}/functions/v1/d4sign-proxy`, {
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
                sendBody = await sendRes.json().catch(() => ({})) as Record<string, unknown>;
                sentToSign = sendRes.ok && (sendBody?.ok !== false) && !sendBody?.error;
                console.log("[generate-verba-doc] send_to_sign resultado:", sendRes.status, JSON.stringify(sendBody));

                if (!sentToSign) {
                  console.error("[generate-verba-doc] send_to_sign FALHOU:", JSON.stringify(sendBody));
                  await supabase.from("verba_indenizatoria_logs").insert({
                    document_id: docRecord.id,
                    action: "error",
                    details: { step: "send_to_sign", response: sendBody },
                    performed_by: user.id,
                  });
                }
              }

              // Atualizar registro com status real
              const finalStatus = sentToSign ? "sent_to_sign" : "error";
              await supabase
                .from("verba_indenizatoria_documents")
                .update({
                  d4sign_document_uuid: d4signDocUuid,
                  d4sign_safe_uuid: d4config.safe_id,
                  d4sign_status: finalStatus,
                  d4sign_signer_email: signerEmailToUse || null,
                  d4sign_sent_at: sentToSign ? new Date().toISOString() : null,
                  d4sign_error_message: !sentToSign
                    ? `add_signer: ${signerAdded ? "ok" : JSON.stringify(addSignerBody?.data || "falhou")} | send_to_sign: ${sentToSign ? "ok" : JSON.stringify(sendBody?.data || "não executado")}`
                    : null,
                })
                .eq("id", docRecord.id);

              await supabase.from("verba_indenizatoria_logs").insert({
                document_id: docRecord.id,
                action: finalStatus === "sent_to_sign" ? "sent_to_sign" : "error",
                details: {
                  d4sign_uuid: d4signDocUuid,
                  signer_email: signerEmailToUse,
                  signer_added: signerAdded,
                  sent: sentToSign,
                },
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
