import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

function sanitizeError(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompetencia(competencia: string): string {
  const [year, month] = competencia.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${months[parseInt(month, 10) - 1]}/${year}`;
}

interface NotificationRequest {
  documentId: string;
  type: "initial" | "reminder";
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

    const body = (await req.json()) as NotificationRequest;
    const { documentId, type } = body;

    if (!documentId || !type) {
      return new Response(JSON.stringify({ error: "documentId e type são obrigatórios" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar documento
    const { data: doc, error: docError } = await supabase
      .from("verba_indenizatoria_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const emailTo = doc.employee_email || doc.d4sign_signer_email;
    if (!emailTo) {
      return new Response(
        JSON.stringify({ error: "E-mail do funcionário não disponível" }),
        { status: 422, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const competenciaFormatada = formatCompetencia(doc.competencia);
    const isReminder = type === "reminder";
    const subject = isReminder
      ? `[Lembrete] Assinatura pendente — Verba Indenizatória ${competenciaFormatada}`
      : `Assinatura requerida — Verba Indenizatória ${competenciaFormatada}`;

    const valorTotal = Number(doc.valor_verba) + Number(doc.valor_adiantamento);

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1162A5; color: white; padding: 20px 24px; border-radius: 6px 6px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 24px; background: #f9f9f9; }
    .info-box { background: white; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { color: #666; font-size: 13px; }
    .value { font-weight: bold; font-size: 13px; }
    .total-box { background: #1162A5; color: white; padding: 16px; border-radius: 6px; text-align: center; margin: 16px 0; }
    .total-box .amount { font-size: 24px; font-weight: bold; margin-top: 4px; }
    .cta { background: #1162A5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 15px; font-weight: bold; margin: 16px 0; }
    .footer { padding: 16px 24px; font-size: 11px; color: #999; background: #f0f0f0; border-radius: 0 0 6px 6px; }
    .reminder-badge { background: #f59e0b; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; display: inline-block; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${isReminder ? "⚠️ Lembrete: " : ""}Assinatura de Documento</h1>
    <p style="margin:4px 0 0 0;font-size:13px;opacity:0.85">Verba Indenizatória — ${competenciaFormatada}</p>
  </div>
  <div class="content">
    ${isReminder ? `<div class="reminder-badge">Lembrete — Assinatura Pendente</div>` : ""}
    <p>Olá, <strong>${doc.employee_name}</strong>,</p>
    <p>
      ${isReminder
        ? "Este é um lembrete de que seu documento de Verba Indenizatória ainda aguarda sua assinatura digital."
        : "Um documento de Verba Indenizatória foi gerado para sua assinatura digital."}
    </p>

    <div class="info-box">
      <div class="info-row">
        <span class="label">Competência</span>
        <span class="value">${competenciaFormatada}</span>
      </div>
      <div class="info-row">
        <span class="label">Empresa</span>
        <span class="value">${doc.employee_accounting_group || "—"}</span>
      </div>
      <div class="info-row">
        <span class="label">Cargo</span>
        <span class="value">${doc.employee_position || "—"}</span>
      </div>
      ${doc.valor_verba > 0 ? `
      <div class="info-row">
        <span class="label">Verba Indenizatória</span>
        <span class="value">${formatBRL(Number(doc.valor_verba))}</span>
      </div>` : ""}
      ${doc.valor_adiantamento > 0 ? `
      <div class="info-row">
        <span class="label">Adiantamento</span>
        <span class="value">${formatBRL(Number(doc.valor_adiantamento))}</span>
      </div>` : ""}
    </div>

    <div class="total-box">
      <div>Valor Total</div>
      <div class="amount">${formatBRL(valorTotal)}</div>
    </div>

    <p>Para assinar o documento, acesse o link enviado pela D4Sign em seu e-mail ou clique no botão abaixo para acessar a plataforma de assinatura:</p>

    <p style="font-size:12px;color:#666;">
      O link de assinatura foi enviado diretamente pela D4Sign. Verifique sua caixa de entrada e spam.
    </p>

    <p style="margin-top:24px;">Dúvidas? Entre em contato com o departamento de Recursos Humanos.</p>
  </div>
  <div class="footer">
    Esta mensagem foi enviada automaticamente pelo sistema GA360 do Grupo Arantes.<br>
    Por favor, não responda a este e-mail.
  </div>
</body>
</html>`;

    // Enviar e-mail via send-email-smtp
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-email-smtp`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: emailTo,
        subject,
        html,
        from_name: "GA360 — Grupo Arantes",
      }),
    });

    if (!emailResp.ok) {
      const errData = await emailResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: "Falha ao enviar e-mail", details: errData }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Atualizar documento
    const now = new Date().toISOString();
    const updateFields = isReminder
      ? {
          email_reminder_count: (doc.email_reminder_count ?? 0) + 1,
          last_reminder_at: now,
          updated_at: now,
        }
      : { email_sent_at: now, updated_at: now };

    await supabase
      .from("verba_indenizatoria_documents")
      .update(updateFields)
      .eq("id", documentId);

    // Log
    await supabase.from("verba_indenizatoria_logs").insert({
      document_id: documentId,
      action: isReminder ? "reminder_sent" : "email_sent",
      details: { to: emailTo, type },
      performed_by: user.id,
    });

    return new Response(
      JSON.stringify({ ok: true, to: emailTo }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
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
