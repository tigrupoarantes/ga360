import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SMTP_TIMEOUT_MS = 10000;

function chunkBase64(str: string, size = 76): string {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks.join('\r\n');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} after ${ms}ms`)), ms)
    ),
  ]);
}

async function readResponse(conn: Deno.Conn): Promise<string> {
  const buffer = new Uint8Array(4096);
  const n = await withTimeout(
    conn.read(buffer).then(n => {
      if (n === null) throw new Error('No response from SMTP server');
      return n;
    }),
    SMTP_TIMEOUT_MS,
    'SMTP read'
  );
  return decoder.decode(buffer.subarray(0, n as number));
}

async function sendCommand(conn: Deno.Conn, cmd: string, expectedCode: string, label: string): Promise<string> {
  await withTimeout(conn.write(encoder.encode(cmd + '\r\n')), SMTP_TIMEOUT_MS, `SMTP write ${label}`);
  const response = await readResponse(conn);
  console.log(`[SMTP] ${label}: ${response.trim()}`);
  if (!response.startsWith(expectedCode)) {
    throw new Error(`SMTP ${label} failed: expected ${expectedCode}, got: ${response.trim()}`);
  }
  return response;
}

async function sendEmail(opts: {
  host: string; port: number; user: string; password: string;
  encryption: string; fromName: string; fromAddress: string;
  replyTo: string; toEmail: string; subject: string; html: string;
}) {
  const { host, port, user, password, encryption, fromName, fromAddress, replyTo, toEmail, subject, html } = opts;

  console.log(`[SMTP] Connecting to ${host}:${port} (${encryption})...`);

  let conn: Deno.Conn;
  if (encryption === 'ssl') {
    conn = await withTimeout(Deno.connectTls({ hostname: host, port }), SMTP_TIMEOUT_MS, 'TLS connect');
  } else {
    conn = await withTimeout(Deno.connect({ hostname: host, port }), SMTP_TIMEOUT_MS, 'TCP connect');
  }

  try {
    const greeting = await readResponse(conn);
    console.log(`[SMTP] Greeting: ${greeting.trim()}`);
    if (!greeting.startsWith('220')) throw new Error(`Bad greeting: ${greeting.trim()}`);

    await sendCommand(conn, 'EHLO localhost', '250', 'EHLO');
    await sendCommand(conn, 'AUTH LOGIN', '334', 'AUTH LOGIN');
    await sendCommand(conn, btoa(user), '334', 'USERNAME');
    await sendCommand(conn, btoa(password), '235', 'PASSWORD');
    await sendCommand(conn, `MAIL FROM:<${fromAddress}>`, '250', 'MAIL FROM');
    await sendCommand(conn, `RCPT TO:<${toEmail}>`, '250', 'RCPT TO');
    await sendCommand(conn, 'DATA', '354', 'DATA');

    const boundary = `boundary_${Date.now()}`;
    const plainB64 = chunkBase64(btoa(unescape(encodeURIComponent('Você foi convidado. Acesse o link no email HTML.'))));
    const htmlB64 = chunkBase64(btoa(unescape(encodeURIComponent(html))));

    const headers = [
      `From: "${fromName}" <${fromAddress}>`,
      `To: ${toEmail}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    if (replyTo) headers.push(`Reply-To: ${replyTo}`);
    headers.push(`Date: ${new Date().toUTCString()}`);

    const message = [
      ...headers,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      '',
      plainB64,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      '',
      htmlB64,
      '',
      `--${boundary}--`,
      '',
      '.',
    ].join('\r\n');

    await withTimeout(conn.write(encoder.encode(message + '\r\n')), SMTP_TIMEOUT_MS, 'DATA body write');
    const dataResponse = await readResponse(conn);
    console.log(`[SMTP] DATA response: ${dataResponse.trim()}`);
    if (!dataResponse.startsWith('250')) {
      throw new Error(`DATA send failed: ${dataResponse.trim()}`);
    }

    await conn.write(encoder.encode('QUIT\r\n'));
    console.log(`✅ [SMTP] Email sent successfully to ${toEmail}`);
  } finally {
    try { conn.close(); } catch (_) { /* ignore */ }
  }
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

    const { data: invite, error: inviteError } = await supabase
      .from('user_invites')
      .select('token')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      throw new Error('Invite not found');
    }

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
    const replyTo = emailConfig.reply_to || '';

    // Send email in background with full error handling
    const sendEmailTask = (async () => {
      try {
        await sendEmail({
          host, port, user, password, encryption,
          fromName, fromAddress, replyTo, toEmail: email,
          subject, html: emailHtml,
        });
      } catch (err: any) {
        console.error(`❌ Failed to send invite email to ${email}:`, err.message);
      }
    })();

    EdgeRuntime.waitUntil(sendEmailTask);

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
