import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { auditId } = await req.json();
    
    if (!auditId) {
      throw new Error("auditId is required");
    }

    console.log(`Generating report for audit: ${auditId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    if (lovableApiKey && divergentItems.length > 0) {
      try {
        aiAnalysis = await generateAIAnalysis(lovableApiKey, audit, divergentItems, { total, ok, divergent });
      } catch (e) {
        console.error("AI analysis failed:", e);
        aiAnalysis = "Análise automática não disponível.";
      }
    } else if (divergentItems.length === 0) {
      aiAnalysis = "✅ Nenhuma divergência encontrada. A auditoria indica conformidade total do estoque físico com o sistema.";
    } else {
      aiAnalysis = "Análise automática não configurada.";
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

    // Send email via Resend
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "resend_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    const emailTo = [governanceEmail, ...ccEmails].filter(Boolean);
    
    const { error: emailError } = await resend.emails.send({
      from: "GA 360 <noreply@grupoarantes.com.br>",
      to: emailTo,
      subject: `[Auditoria Estoque] ${unitName} - ${auditDate}`,
      html: htmlReport,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      
      // Still save the report even if email fails
      await supabase
        .from("stock_audits")
        .update({
          report_html: htmlReport,
        })
        .eq("id", auditId);

      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "email_failed", error: emailError.message, reportSaved: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log(`Report email sent to: ${emailTo.join(", ")}`);

    return new Response(
      JSON.stringify({ success: true, emailSent: true, sentTo: emailTo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAIAnalysis(
  apiKey: string, 
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

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um auditor especialista em controles internos e gestão de estoques." },
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
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
