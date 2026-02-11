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

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

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

    // Get invite token
    const { data: invite, error: inviteError } = await supabase
      .from('user_invites')
      .select('token')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      throw new Error('Invite not found');
    }

    // Get email config
    const { data: emailConfigData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'email_config')
      .single();

    const emailConfig = emailConfigData?.value as unknown as EmailConfig | null;
    const fromName = emailConfig?.from_name || 'GA 360';
    const registrationUrl = `${appUrl}/auth?invite=${invite.token}`;

    if (!emailConfig?.smtp?.host) {
      throw new Error('Configuração SMTP não encontrada.');
    }

    const password = Deno.env.get('SMTP_PASSWORD');
    if (!password) {
      throw new Error('SMTP_PASSWORD secret não configurado.');
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0B3D91 0%, #007A7A 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${fromName}</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #0B3D91; margin-top: 0;">Olá${firstName ? `, ${firstName}` : ''}!</h2>
          <p style="color: #333; line-height: 1.6;">
            Você foi convidado para participar do sistema <strong>${fromName}</strong>.
          </p>
          <div style="background: #f6f7f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <p style="color: #666; margin: 0;">
              <strong>📧 Email:</strong> ${email}<br/>
              ${roles ? `<strong>👤 Perfil:</strong> ${roles.join(', ')}` : ''}
            </p>
          </div>
          <p style="color: #333; line-height: 1.6;">Para ativar sua conta, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" 
               style="background: linear-gradient(135deg, #0B3D91 0%, #007A7A 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Ativar Minha Conta
            </a>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
            <a href="${registrationUrl}" style="color: #0B3D91; word-break: break-all;">${registrationUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            Este convite expira em 7 dias.<br/>
            Se você não solicitou este convite, ignore este email.
          </p>
        </div>
      </div>
    `;

    const subject = `Convite para ${fromName}`;
    const host = emailConfig.smtp.host;
    const port = parseInt(emailConfig.smtp.port || '465');
    const user = emailConfig.smtp.user;
    const encryption = emailConfig.smtp.encryption || 'ssl';
    const fromAddress = emailConfig.from_email || user;
    const fromDisplay = `${fromName} <${fromAddress}>`;
    const replyTo = emailConfig.reply_to;

    // Send email in background using EdgeRuntime.waitUntil
    // This allows us to return the response immediately while the SMTP send continues
    const sendEmailTask = (async () => {
      try {
        console.log(`[SMTP] Connecting to ${host}:${port} (${encryption})`);
        console.log(`[SMTP] User: ${user}`);
        console.log(`[SMTP] From: ${fromDisplay}`);
        console.log(`[SMTP] To: ${email}`);

        const clientConfig: any = {
          connection: {
            hostname: host,
            port: port,
            auth: {
              username: user,
              password: password,
            },
          },
          debug: {
            log: true,
          },
        };

        if (encryption === 'ssl') {
          clientConfig.connection.tls = true;
        } else if (encryption === 'tls') {
          clientConfig.connection.tls = false;
        }

        const client = new SMTPClient(clientConfig);

        console.log(`[SMTP] Client created, sending...`);

        const sendResult = await client.send({
          from: fromDisplay,
          to: [email],
          subject: subject,
          content: `Você foi convidado para o ${fromName}. Acesse: ${registrationUrl}`,
          html: emailHtml,
          headers: replyTo ? { 'Reply-To': replyTo } : undefined,
        });

        console.log(`[SMTP] Send result:`, JSON.stringify(sendResult));

        await client.close();
        console.log(`✅ [SMTP] Email sent and connection closed for ${email}`);
      } catch (err: any) {
        console.error(`❌ [SMTP] Failed for ${email}:`, err.message);
        console.error(`❌ [SMTP] Stack:`, err.stack);
      }
    })();

    // Keep the function alive in the background to complete the SMTP send
    EdgeRuntime.waitUntil(sendEmailTask);

    // Return response immediately without waiting for SMTP
    return new Response(
      JSON.stringify({ success: true, message: 'Convite sendo enviado' }),
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
