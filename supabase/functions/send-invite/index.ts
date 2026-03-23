import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmailConfig {
  enabled: boolean;
  provider: 'resend' | 'smtp';
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviteId, email, firstName, lastName, roles, appUrl } = await req.json();

    if (!inviteId || !email) {
      throw new Error('inviteId and email are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Busca o token do convite
    const { data: invite, error: inviteError } = await supabase
      .from('user_invites')
      .select('token')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      throw new Error('Invite not found');
    }

    // Busca configuração de email do banco (salva em Configurações do Sistema)
    const { data: emailConfigData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'email_config')
      .single();

    const emailConfig = emailConfigData?.value as EmailConfig | null;

    // Config SMTP: banco tem prioridade, env vars são fallback
    const host = emailConfig?.smtp?.host || Deno.env.get('SMTP_HOST') || '';
    const port = parseInt(emailConfig?.smtp?.port || Deno.env.get('SMTP_PORT') || '465');
    const user = emailConfig?.smtp?.user || Deno.env.get('SMTP_USER') || '';
    const encryption = (emailConfig?.smtp?.encryption || Deno.env.get('SMTP_ENCRYPTION') || 'ssl') as 'tls' | 'ssl' | 'none';
    const fromName = emailConfig?.from_name || Deno.env.get('SMTP_FROM_NAME') || 'GA 360';
    const fromAddress = emailConfig?.from_email || user;
    const replyTo = emailConfig?.reply_to || '';

    // Senha vem sempre de env var (nunca armazenada no banco)
    const password = Deno.env.get('SMTP_PASSWORD');
    if (!password) {
      throw new Error('SMTP_PASSWORD secret não configurado.');
    }

    if (!host || !user) {
      throw new Error('Configuração SMTP não encontrada. Configure em Configurações do Sistema → Email.');
    }

    const configuredPublicUrl = Deno.env.get('PUBLIC_SITE_URL');
    const APP_URL = (configuredPublicUrl || appUrl || 'http://localhost:3000').replace(/\/$/, '');
    const registrationUrl = `${APP_URL}/auth?invite=${invite.token}`;

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f0f5;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f5;padding:30px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#06B6D4 100%);padding:32px 40px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${fromName}</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Plataforma de Gestão Estratégica</p>
</td>
</tr></table>
</td></tr>

<!-- Body -->
<tr><td style="padding:36px 40px;">
<h2 style="color:#1a1a2e;margin:0 0 8px;font-size:22px;font-weight:600;">Ol&#225;${firstName ? `, ${firstName}` : ''}!</h2>
<p style="color:#4a4a68;margin:0 0 24px;font-size:16px;line-height:1.6;">
Você foi convidado para participar do <strong style="color:#8B5CF6;">${fromName}</strong>.
</p>

<!-- Info Card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7ff;border-radius:8px;border-left:4px solid #8B5CF6;margin:0 0 28px;">
<tr><td style="padding:16px 20px;">
<p style="color:#4a4a68;margin:0;font-size:14px;line-height:1.8;">
<strong>Email:</strong> ${email}<br/>
${roles ? `<strong>Perfil:</strong> ${roles.join(', ')}` : ''}
</p>
</td></tr>
</table>

<p style="color:#4a4a68;margin:0 0 24px;font-size:16px;line-height:1.6;">
Para ativar sua conta e começar a usar a plataforma, clique no botão abaixo:
</p>

<!-- CTA Button -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:8px 0 28px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${registrationUrl}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="12%" fillcolor="#8B5CF6">
<w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Ativar Minha Conta</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${registrationUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6 0%,#06B6D4 100%);color:#ffffff;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(139,92,246,0.35);">
Ativar Minha Conta
</a>
<!--<![endif]-->
</td></tr>
</table>

<p style="color:#6b6b8a;font-size:13px;line-height:1.6;margin:0 0 8px;">
Se o botão não funcionar, copie e cole este link no seu navegador:
</p>
<p style="margin:0 0 0;"><a href="${registrationUrl}" style="color:#8B5CF6;font-size:13px;word-break:break-all;text-decoration:underline;">${registrationUrl}</a></p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 40px 28px;border-top:1px solid #e8e8f0;">
<p style="color:#9999b3;font-size:12px;margin:0;line-height:1.6;text-align:center;">
Este convite expira em 7 dias.<br/>
Se você não solicitou este convite, ignore este email.
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    // Envia via denomailer (suporta SSL implícito e STARTTLS corretamente)
    const clientConfig: Record<string, unknown> = {
      connection: {
        hostname: host,
        port,
        auth: {
          username: user,
          password,
        },
      },
    };

    if (encryption === 'ssl') {
      (clientConfig.connection as Record<string, unknown>).tls = true;   // SSL implícito porta 465
    } else if (encryption === 'tls') {
      (clientConfig.connection as Record<string, unknown>).tls = false;  // STARTTLS porta 587
    }

    const client = new SMTPClient(clientConfig);

    await client.send({
      from: `${fromName} <${fromAddress}>`,
      to: email,
      subject: `Convite para ${fromName}`,
      html: emailHtml,
      content: `Você foi convidado para o ${fromName}. Acesse: ${registrationUrl}`,
      headers: replyTo ? { 'Reply-To': replyTo } : undefined,
    });

    await client.close();

    console.log(`✅ Convite enviado para ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Convite enviado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-invite:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
