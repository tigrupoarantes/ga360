import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    encryption: "tls" | "ssl" | "none";
  };
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompetence(comp: string): string {
  const [year, month] = comp.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(month, 10) - 1]} / ${year}`;
}

// ---------------------------------------------------------------------------
// Build the e-mail HTML body (lighter than the full payslip — a summary
// with a link / attachment instructions).
// ---------------------------------------------------------------------------
function buildEmailHTML(
  contractName: string,
  companyName: string,
  competence: string,
  totalValue: number,
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f4f5f7;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:24px 28px;">
      <h1 style="margin:0;font-size:18px;">Holerite Disponível</h1>
      <p style="margin:4px 0 0;opacity:.85;font-size:13px;">${companyName} · GA 360</p>
    </div>
    <div style="padding:24px 28px;font-size:14px;color:#374151;line-height:1.6;">
      <p>Olá <strong>${contractName}</strong>,</p>
      <p>Seu holerite referente à competência <strong>${formatCompetence(competence)}</strong> está disponível.</p>
      <div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:14px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
        <span style="font-size:13px;color:#6b7280;">Valor líquido</span><br/>
        <span style="font-size:22px;font-weight:700;color:#1e40af;">${formatBRL(totalValue)}</span>
      </div>
      <p>O documento completo segue em anexo neste e-mail.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Este é um e-mail automático enviado pelo GA 360.<br/>Em caso de dúvidas, entre em contato com o departamento pessoal.</p>
    </div>
    <div style="padding:12px 28px;background:#f9fafb;text-align:center;font-size:11px;color:#9ca3af;">
      GA 360 · Sistema de Governança Corporativa
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { closingId } = await req.json();

    if (!closingId) {
      throw new Error("closingId is required");
    }

    console.log(`[send-pj-payslip-email] Sending payslip for closing: ${closingId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Fetch closing ----
    const { data: closing, error: closingError } = await supabase
      .from("pj_closings")
      .select("*")
      .eq("id", closingId)
      .single();

    if (closingError || !closing) {
      throw new Error("Fechamento não encontrado");
    }

    if (!closing.payslip_pdf_url) {
      throw new Error("Holerite ainda não foi gerado para este fechamento");
    }

    // ---- Fetch contract ----
    const { data: contract, error: contractError } = await supabase
      .from("pj_contracts")
      .select(`
        *,
        company:companies!pj_contracts_company_id_fkey(name)
      `)
      .eq("id", closing.contract_id)
      .single();

    if (contractError || !contract) {
      throw new Error("Contrato PJ não encontrado");
    }

    const recipientEmail = contract.email;
    if (!recipientEmail) {
      throw new Error("E-mail do prestador não informado no contrato");
    }

    // ---- Load email config from system_settings ----
    const { data: emailConfigData, error: emailConfigError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "email_config")
      .single();

    if (emailConfigError || !emailConfigData?.value) {
      console.error("Error fetching email config:", emailConfigError);
      await updateClosingEmailStatus(supabase, closingId, "failed", "Configuração de e-mail não encontrada");
      throw new Error("Configuração de e-mail não encontrada no sistema");
    }

    const emailConfig = emailConfigData.value as EmailConfig;

    if (!emailConfig.enabled) {
      await updateClosingEmailStatus(supabase, closingId, "failed", "E-mail desabilitado nas configurações");
      throw new Error("Envio de e-mail está desabilitado nas configurações do sistema");
    }

    if (!emailConfig.smtp?.host || !emailConfig.smtp?.user || !smtpPassword) {
      await updateClosingEmailStatus(supabase, closingId, "failed", "Config SMTP incompleta");
      throw new Error("Configuração SMTP incompleta (host, user ou password ausente)");
    }

    // ---- Download the payslip HTML from storage to attach ----
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("holerites")
      .download(closing.payslip_pdf_url);

    if (downloadError || !fileData) {
      console.error("Error downloading payslip:", downloadError);
      await updateClosingEmailStatus(supabase, closingId, "failed", "Erro ao baixar holerite do storage");
      throw new Error("Erro ao baixar holerite do storage");
    }

    const payslipBytes = new Uint8Array(await fileData.arrayBuffer());
    const payslipBase64 = btoa(String.fromCharCode(...payslipBytes));

    // ---- Create email log (queued) ----
    const companyName = contract.company?.[0]?.name || "Empresa";
    const competenceLabel = formatCompetence(closing.competence);
    const subject = `[Holerite] ${companyName} – ${competenceLabel}`;

    const { data: emailLog, error: logError } = await supabase
      .from("pj_email_logs")
      .insert({
        closing_id: closingId,
        to_email: recipientEmail,
        subject,
        status: "queued",
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating email log:", logError);
    }

    // ---- Mark closing as queued ----
    await supabase
      .from("pj_closings")
      .update({ email_status: "queued" })
      .eq("id", closingId);

    // ---- Build email body ----
    const emailHTML = buildEmailHTML(
      contract.name,
      companyName,
      closing.competence,
      Number(closing.total_value),
    );

    // ---- Send via SMTP ----
    const smtpHost = emailConfig.smtp.host;
    const smtpPort = parseInt(emailConfig.smtp.port) || 465;
    const smtpUser = emailConfig.smtp.user;
    const encryption = emailConfig.smtp.encryption || "tls";
    const fromName = emailConfig.from_name || "GA 360";
    const fromEmail = emailConfig.from_email || smtpUser;

    const useTls = encryption === "ssl" || smtpPort === 465;

    console.log(`[send-pj-payslip-email] Connecting SMTP ${smtpHost}:${smtpPort} → ${recipientEmail}`);

    try {
      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: smtpPort,
          tls: useTls,
          auth: {
            username: smtpUser,
            password: smtpPassword!,
          },
        },
      });

      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: [recipientEmail],
        subject,
        content: "auto",
        html: emailHTML,
        attachments: [
          {
            filename: `holerite-${closing.competence}.html`,
            content: payslipBase64,
            encoding: "base64",
            contentType: "text/html",
          },
        ],
      });

      await client.close();

      console.log(`[send-pj-payslip-email] ✅ Email sent to ${recipientEmail}`);

      // ---- Update statuses ----
      const now = new Date().toISOString();

      await supabase
        .from("pj_closings")
        .update({
          email_status: "sent",
          email_sent_at: now,
          email_error: null,
        })
        .eq("id", closingId);

      if (emailLog?.id) {
        await supabase
          .from("pj_email_logs")
          .update({ status: "sent" })
          .eq("id", emailLog.id);
      }

      return new Response(
        JSON.stringify({ success: true, emailSent: true, sentTo: recipientEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (smtpError: unknown) {
      console.error("[send-pj-payslip-email] ❌ SMTP error:", smtpError);

      const errorMsg = smtpError instanceof Error ? smtpError.message : "Erro SMTP desconhecido";

      await updateClosingEmailStatus(supabase, closingId, "failed", errorMsg);

      if (emailLog?.id) {
        await supabase
          .from("pj_email_logs")
          .update({ status: "failed", error: errorMsg })
          .eq("id", emailLog.id);
      }

      return new Response(
        JSON.stringify({ success: false, emailSent: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error: unknown) {
    console.error("[send-pj-payslip-email] Error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ---------------------------------------------------------------------------
// Helper: update closing email status
// ---------------------------------------------------------------------------
async function updateClosingEmailStatus(
  supabase: ReturnType<typeof createClient>,
  closingId: string,
  status: string,
  errorMsg?: string,
) {
  await supabase
    .from("pj_closings")
    .update({
      email_status: status,
      email_error: errorMsg || null,
    })
    .eq("id", closingId);
}
