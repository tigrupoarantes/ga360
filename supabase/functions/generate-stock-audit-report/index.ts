import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

interface AuditItem {
  sku_code: string;
  sku_description: string | null;
  uom: string | null;
  system_qty: number;
  physical_qty: number | null;
  recount_qty: number | null;
  final_physical_qty: number | null;
  result: string;
  root_cause_code: string | null;
  root_cause_notes: string | null;
}

interface AuditData {
  id: string;
  unit: { name: string }[] | null;
  auditor: { first_name: string; last_name: string }[] | null;
  executed_date: string | null;
  completed_at: string | null;
  witness_name: string | null;
  witness_cpf: string | null;
  movement_during_audit: boolean;
  movement_notes: string | null;
  sample_size: number | null;
}

interface EmailConfig {
  enabled: boolean;
  provider: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  smtp: {
    host: string;
    port: string;
    user: string;
    encryption: 'tls' | 'ssl' | 'none';
  };
}

interface OpenAIConfig {
  enabled: boolean;
  api_key: string;
  default_model: string;
  transcription_model: string;
}

async function getOpenAIConfig(supabase: any): Promise<{ apiKey: string; model: string } | null> {
  // Try to get config from database first
  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "openai_config")
    .single();

  const openaiConfig = settings?.value as OpenAIConfig | null;
  
  if (openaiConfig?.enabled && openaiConfig?.api_key) {
    return {
      apiKey: openaiConfig.api_key,
      model: openaiConfig.default_model || "gpt-4o",
    };
  }

  // Fallback to environment variable
  const envApiKey = Deno.env.get("OPENAI_API_KEY");
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      model: "gpt-4o",
    };
  }

  return null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { auditId } = await req.json();
    
    if (!auditId) {
      throw new Error("auditId is required");
    }

    console.log(`Generating report for audit: ${auditId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get OpenAI configuration
    const openaiConfig = await getOpenAIConfig(supabase);

    // Fetch audit data with unit and auditor
    const { data: audit, error: auditError } = await supabase
      .from("stock_audits")
      .select(`
        id,
        executed_date,
        completed_at,
        witness_name,
        witness_cpf,
        movement_during_audit,
        movement_notes,
        sample_size,
        unit:companies!stock_audits_unit_id_fkey(name),
        auditor:profiles!stock_audits_auditor_user_id_fkey(first_name, last_name)
      `)
      .eq("id", auditId)
      .single();

    if (auditError || !audit) {
      console.error("Error fetching audit:", auditError);
      throw new Error("Audit not found");
    }

    // Fetch audit items (sample only)
    const { data: items, error: itemsError } = await supabase
      .from("stock_audit_items")
      .select("*")
      .eq("stock_audit_id", auditId)
      .eq("is_in_sample", true);

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      throw new Error("Failed to fetch audit items");
    }

    // Fetch settings for governance email
    const { data: settings } = await supabase
      .from("stock_audit_settings")
      .select("governance_email, cc_emails")
      .limit(1)
      .single();

    const governanceEmail = settings?.governance_email;
    const ccEmails = settings?.cc_emails as string[] || [];

    if (!governanceEmail) {
      console.warn("No governance email configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "no_email_configured" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Fetch SMTP email configuration
    const { data: emailConfigData, error: emailConfigError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_config")
      .single();

    if (emailConfigError || !emailConfigData?.value) {
      console.error("Error fetching email config:", emailConfigError);
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "email_config_not_found" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const emailConfig = emailConfigData.value as EmailConfig;

    if (!emailConfig.enabled) {
      console.warn("Email is disabled in system settings");
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "email_disabled" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!emailConfig.smtp?.host || !emailConfig.smtp?.user || !smtpPassword) {
      console.error("SMTP configuration incomplete:", {
        host: emailConfig.smtp?.host,
        user: emailConfig.smtp?.user,
        hasPassword: !!smtpPassword,
      });
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "smtp_config_incomplete" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Calculate stats
    const total = items?.length || 0;
    const ok = items?.filter(i => i.result === "ok").length || 0;
    const divergent = items?.filter(i => i.result === "divergent" || i.result === "divergent_confirmed").length || 0;
    const recounted = items?.filter(i => i.recount_qty !== null).length || 0;

    // Get divergent items for report
    const divergentItems = items?.filter(i => 
      i.result === "divergent" || i.result === "divergent_confirmed"
    ) || [];

    // Generate AI analysis
    let aiAnalysis = "";
    if (openaiConfig && divergentItems.length > 0) {
      try {
        aiAnalysis = await generateAIAnalysis(openaiConfig.apiKey, openaiConfig.model, audit, divergentItems, { total, ok, divergent });
      } catch (e) {
        console.error("AI analysis failed:", e);
        aiAnalysis = "Análise automática não disponível.";
      }
    } else if (divergentItems.length === 0) {
      aiAnalysis = "✅ Nenhuma divergência encontrada. A auditoria indica conformidade total do estoque físico com o sistema.";
    } else {
      aiAnalysis = "Análise automática não configurada. Configure a API Key da OpenAI em Configurações > IA.";
    }

    // Format date
    const auditDate = audit.completed_at 
      ? new Date(audit.completed_at).toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR");
    
    const auditDateTime = audit.completed_at
      ? new Date(audit.completed_at).toLocaleString("pt-BR")
      : new Date().toLocaleString("pt-BR");

    const unitName = audit.unit?.[0]?.name || "Unidade não identificada";
    const auditorName = audit.auditor?.[0]
      ? `${audit.auditor[0].first_name} ${audit.auditor[0].last_name}`.trim() 
      : "Auditor não identificado";

    // Generate HTML report
    const htmlReport = generateHtmlReport({
      unitName,
      auditorName,
      auditDate,
      auditDateTime,
      witnessName: audit.witness_name,
      witnessCpf: audit.witness_cpf,
      stats: { total, ok, divergent, recounted },
      divergentItems,
      aiAnalysis,
      movementDuringAudit: audit.movement_during_audit,
      movementNotes: audit.movement_notes,
    });

    // Configure and send via SMTP
    const smtpHost = emailConfig.smtp.host;
    const smtpPort = parseInt(emailConfig.smtp.port) || 465;
    const smtpUser = emailConfig.smtp.user;
    const encryption = emailConfig.smtp.encryption || "tls";
    const fromName = emailConfig.from_name || "GA 360";
    const fromEmail = emailConfig.from_email || smtpUser;

    const emailTo = [governanceEmail, ...ccEmails].filter(Boolean);

    console.log(`Sending email via SMTP: ${smtpHost}:${smtpPort} from ${fromEmail} to ${emailTo.join(", ")}`);

    try {
      // Configure SMTP client based on encryption type
      // Port 465 uses implicit SSL (tls: true from start)
      // Port 587 uses STARTTLS (tls: false, then upgrade)
      const useTls = encryption === "ssl" || smtpPort === 465;

      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: smtpPort,
          tls: useTls,
          auth: {
            username: smtpUser,
            password: smtpPassword,
          },
        },
      });

      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: emailTo,
        subject: `[Auditoria Estoque] ${unitName} - ${auditDate}`,
        content: "auto",
        html: htmlReport,
      });

      await client.close();
      console.log("✅ Report email sent successfully via SMTP");

      // Save the report and email tracking info
      const { error: updateError } = await supabase
        .from("stock_audits")
        .update({
          report_html: htmlReport,
          report_sent_at: new Date().toISOString(),
          report_sent_to: emailTo,
        })
        .eq("id", auditId);

      if (updateError) {
        console.error("Error saving report to DB:", updateError);
      }

      return new Response(
        JSON.stringify({ success: true, emailSent: true, sentTo: emailTo }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );

    } catch (smtpError: unknown) {
      console.error("❌ SMTP send error:", smtpError);
      
      // Still save the report even if email fails
      await supabase
        .from("stock_audits")
        .update({
          report_html: htmlReport,
        })
        .eq("id", auditId);

      const errorMessage = smtpError instanceof Error ? smtpError.message : "Unknown SMTP error";
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "smtp_failed", error: errorMessage, reportSaved: true }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("Error generating report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

async function generateAIAnalysis(
  apiKey: string,
  model: string,
  audit: AuditData, 
  divergentItems: AuditItem[],
  stats: { total: number; ok: number; divergent: number }
): Promise<string> {
  const divergenceRate = stats.total > 0 ? ((stats.divergent / stats.total) * 100).toFixed(1) : "0";
  
  const itemsSummary = divergentItems.slice(0, 10).map(item => {
    const diff = (item.physical_qty || 0) - item.system_qty;
    const diffPct = item.system_qty > 0 ? ((diff / item.system_qty) * 100).toFixed(1) : "N/A";
    return `- ${item.sku_code}: Sistema=${item.system_qty}, Físico=${item.physical_qty || 0}, Diff=${diff} (${diffPct}%)`;
  }).join("\n");

  const prompt = `Você é um especialista em auditoria de estoque e controles internos.
Analise os dados desta auditoria de estoque e forneça um relatório conciso em português.

DADOS DA AUDITORIA:
- Unidade: ${audit.unit?.[0]?.name || "N/A"}
- Total de itens na amostra: ${stats.total}
- Itens OK: ${stats.ok}
- Itens divergentes: ${stats.divergent} (${divergenceRate}%)
- Houve movimentação durante auditoria: ${audit.movement_during_audit ? "Sim" : "Não"}
${audit.movement_notes ? `- Notas sobre movimentação: ${audit.movement_notes}` : ""}

ITENS COM DIVERGÊNCIA:
${itemsSummary}

Por favor, forneça:
1. **Resumo Executivo** (2-3 frases sobre a situação geral)
2. **Análise das Divergências** (padrões identificados)
3. **Possíveis Causas Raiz** (hipóteses baseadas nos dados)
4. **Recomendações** (ações corretivas sugeridas)
5. **Nível de Risco**: [BAIXO/MÉDIO/ALTO] com justificativa

Seja objetivo e focado em insights acionáveis.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: "Você é um auditor especialista em controles internos e gestão de estoques." },
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Análise não disponível.";
}

function generateHtmlReport(params: {
  unitName: string;
  auditorName: string;
  auditDate: string;
  auditDateTime: string;
  witnessName: string | null;
  witnessCpf: string | null;
  stats: { total: number; ok: number; divergent: number; recounted: number };
  divergentItems: AuditItem[];
  aiAnalysis: string;
  movementDuringAudit: boolean;
  movementNotes: string | null;
}): string {
  const { unitName, auditorName, auditDate, auditDateTime, witnessName, witnessCpf, stats, divergentItems, aiAnalysis, movementDuringAudit, movementNotes } = params;

  const okPct = stats.total > 0 ? ((stats.ok / stats.total) * 100).toFixed(1) : "0";
  const divergentPct = stats.total > 0 ? ((stats.divergent / stats.total) * 100).toFixed(1) : "0";

  const divergentRowsHtml = divergentItems.map(item => {
    const physicalQty = item.recount_qty ?? item.physical_qty ?? 0;
    const diff = physicalQty - item.system_qty;
    const diffClass = diff > 0 ? "color: #16a34a;" : diff < 0 ? "color: #dc2626;" : "";
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.sku_code}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.sku_description || "-"}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${item.system_qty}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${physicalQty}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; ${diffClass}">${diff > 0 ? "+" : ""}${diff}</td>
      </tr>
    `;
  }).join("");

  // Convert markdown-style bold to HTML
  const formattedAnalysis = aiAnalysis
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório de Auditoria de Estoque</title>
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f9fafb;">
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">RELATÓRIO DE AUDITORIA DE ESTOQUE</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">GA 360 - Governança Corporativa</p>
    </div>

    <!-- Info Section -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; width: 120px;">Unidade:</td>
          <td style="padding: 4px 0; font-weight: 600;">${unitName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Auditor:</td>
          <td style="padding: 4px 0;">${auditorName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Testemunha:</td>
          <td style="padding: 4px 0;">${witnessName || "-"} ${witnessCpf ? `(CPF: ${formatCPF(witnessCpf)})` : ""}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Data:</td>
          <td style="padding: 4px 0;">${auditDate}</td>
        </tr>
      </table>
    </div>

    <!-- Stats Section -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 16px; font-size: 16px; color: #374151;">RESUMO DA CONTAGEM</h2>
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <tr>
          <td style="padding: 16px; background: #f3f4f6; border-radius: 8px 0 0 8px;">
            <div style="font-size: 28px; font-weight: 700; color: #374151;">${stats.total}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Total</div>
          </td>
          <td style="padding: 16px; background: #dcfce7;">
            <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${stats.ok}</div>
            <div style="font-size: 12px; color: #16a34a; margin-top: 4px;">OK (${okPct}%)</div>
          </td>
          <td style="padding: 16px; background: #fef9c3;">
            <div style="font-size: 28px; font-weight: 700; color: #ca8a04;">${stats.divergent}</div>
            <div style="font-size: 12px; color: #ca8a04; margin-top: 4px;">Divergentes (${divergentPct}%)</div>
          </td>
          <td style="padding: 16px; background: #dbeafe; border-radius: 0 8px 8px 0;">
            <div style="font-size: 28px; font-weight: 700; color: #2563eb;">${stats.recounted}</div>
            <div style="font-size: 12px; color: #2563eb; margin-top: 4px;">Recontados</div>
          </td>
        </tr>
      </table>
    </div>

    ${divergentItems.length > 0 ? `
    <!-- Divergent Items -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 16px; font-size: 16px; color: #374151;">ITENS DIVERGENTES</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Código</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Descrição</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Sistema</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Físico</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Diferença</th>
          </tr>
        </thead>
        <tbody>
          ${divergentRowsHtml}
        </tbody>
      </table>
    </div>
    ` : ""}

    <!-- AI Analysis -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb; background: #f0f9ff;">
      <h2 style="margin: 0 0 16px; font-size: 16px; color: #0369a1;">
        🤖 ANÁLISE E RECOMENDAÇÕES
      </h2>
      <div style="font-size: 14px; line-height: 1.6; color: #374151;">
        ${formattedAnalysis}
      </div>
    </div>

    <!-- Observations -->
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 12px; font-size: 16px; color: #374151;">OBSERVAÇÕES</h2>
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        <strong>Movimentação durante auditoria:</strong> ${movementDuringAudit ? "Sim" : "Não"}
        ${movementNotes ? `<br><em>${movementNotes}</em>` : ""}
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af;">
      Relatório gerado automaticamente em ${auditDateTime}<br>
      GA 360 - Sistema de Governança Corporativa
    </div>

  </div>
</body>
</html>
  `;
}

function formatCPF(cpf: string): string {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length !== 11) return cpf;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
}
