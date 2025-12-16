import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  smtp_config?: {
    host: string;
    port: string;
    user: string;
    password?: string;
    encryption: 'tls' | 'ssl' | 'none';
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from_name, from_email, reply_to, smtp_config } = await req.json() as EmailRequest;

    if (!to || !subject || !html) {
      throw new Error('to, subject, and html are required');
    }

    // Get SMTP config from environment or request
    const host = smtp_config?.host || Deno.env.get('SMTP_HOST');
    const port = parseInt(smtp_config?.port || Deno.env.get('SMTP_PORT') || '587');
    const user = smtp_config?.user || Deno.env.get('SMTP_USER');
    const password = smtp_config?.password || Deno.env.get('SMTP_PASSWORD');
    const encryption = smtp_config?.encryption || Deno.env.get('SMTP_ENCRYPTION') || 'tls';

    if (!host || !user || !password) {
      throw new Error('SMTP configuration is incomplete');
    }

    console.log(`Connecting to SMTP server: ${host}:${port}`);

    // Configure SMTP client based on encryption
    const clientConfig: any = {
      connection: {
        hostname: host,
        port: port,
        auth: {
          username: user,
          password: password,
        },
      },
    };

    // Set TLS options based on encryption type
    if (encryption === 'ssl') {
      clientConfig.connection.tls = true;
    } else if (encryption === 'tls') {
      clientConfig.connection.tls = false; // Start without TLS, then upgrade
    }

    const client = new SMTPClient(clientConfig);

    const recipients = Array.isArray(to) ? to : [to];
    const fromAddress = from_email || user;
    const fromDisplay = from_name ? `${from_name} <${fromAddress}>` : fromAddress;

    console.log(`Sending email from ${fromDisplay} to ${recipients.join(', ')}`);

    // Send email
    await client.send({
      from: fromDisplay,
      to: recipients,
      subject: subject,
      content: html,
      html: html,
      headers: reply_to ? { 'Reply-To': reply_to } : undefined,
    });

    await client.close();

    console.log('Email sent successfully via SMTP');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email enviado com sucesso via SMTP' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending email via SMTP:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
