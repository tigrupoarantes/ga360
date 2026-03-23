import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email?: string;
  appUrl?: string;
}

interface EmailConfig {
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  smtp?: {
    host?: string;
    port?: string;
    user?: string;
    encryption?: 'tls' | 'ssl' | 'none';
  };
}

function buildEmailHtml(params: { resetUrl: string; firstName?: string | null; fromName: string }) {
  const greetingName = params.firstName?.trim() ? `, ${params.firstName.trim()}` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperação de Senha</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6fb;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:32px 40px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">${params.fromName}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Recuperação segura de acesso</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:24px;">Olá${greetingName}</h2>
              <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">
                Recebemos uma solicitação para redefinir a sua senha no GA360.
              </p>
              <p style="margin:0 0 24px;color:#334155;font-size:16px;line-height:1.6;">
                Para continuar, use o botão abaixo. O link leva para o ambiente oficial do GA360 e expira automaticamente.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${params.resetUrl}" target="_blank" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:700;">
                      Redefinir minha senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
                Se você não solicitou esta alteração, pode ignorar este email com segurança.
              </p>
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;word-break:break-all;">
                Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                ${params.resetUrl}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const successPayload = {
    success: true,
    message: "Se o email existir em nossa base, enviaremos as instruções de recuperação.",
  };

  try {
    const { email, appUrl }: PasswordResetRequest = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("APP_URL") || appUrl || "").replace(/\/$/, "");

    if (!publicSiteUrl) {
      console.error("[request-password-reset] PUBLIC_SITE_URL/APP_URL não configurado.");
      return new Response(JSON.stringify({ error: "URL pública do aplicativo não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
    });

    if (resetError || !resetData?.properties) {
      console.warn("[request-password-reset] Falha ao gerar link de recovery:", resetError?.message || "usuário não encontrado");
      return new Response(JSON.stringify(successPayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenHash = resetData.properties.hashed_token;
    if (!tokenHash) {
      console.warn("[request-password-reset] hashed_token ausente para:", normalizedEmail);
      return new Response(JSON.stringify(successPayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name")
      .eq("id", resetData.user?.id || "")
      .maybeSingle();

    const { data: emailConfigData } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "email_config")
      .maybeSingle();

    const emailConfig = emailConfigData?.value as EmailConfig | null;

    // Config SMTP: banco tem prioridade, env vars são fallback
    // (mesma lógica do send-invite — usuário configura em Configurações do Sistema → Email)
    const smtpHost = emailConfig?.smtp?.host || Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(emailConfig?.smtp?.port || Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = emailConfig?.smtp?.user || Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD"); // senha nunca fica no banco
    const smtpEncryption = (emailConfig?.smtp?.encryption || Deno.env.get("SMTP_ENCRYPTION") || "ssl") as "tls" | "ssl" | "none";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error("[request-password-reset] SMTP não configurado. host:", smtpHost, "user:", smtpUser, "password set:", !!smtpPassword);
      return new Response(JSON.stringify({ error: "SMTP não configurado. Configure em Configurações do Sistema → Email." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetUrl = `${publicSiteUrl}/change-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
    const fromName = emailConfig?.from_name?.trim() || "GA360";
    const fromEmail = emailConfig?.from_email?.trim() || smtpUser;
    const replyTo = emailConfig?.reply_to?.trim() || undefined;

    const clientConfig: Record<string, unknown> = {
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    };

    if (smtpEncryption === "ssl") {
      (clientConfig.connection as Record<string, unknown>).tls = true;
    } else if (smtpEncryption === "tls") {
      (clientConfig.connection as Record<string, unknown>).tls = false;
    }

    const client = new SMTPClient(clientConfig);

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: normalizedEmail,
      subject: "GA360 - Redefinição de senha",
      html: buildEmailHtml({
        resetUrl,
        firstName: profile?.first_name,
        fromName,
      }),
      content: `Abra o link para redefinir sua senha: ${resetUrl}`,
      headers: replyTo ? { "Reply-To": replyTo } : undefined,
    });

    await client.close();

    return new Response(JSON.stringify(successPayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[request-password-reset] Erro inesperado:", error);
    return new Response(JSON.stringify({ error: "Falha ao solicitar recuperação de senha" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
