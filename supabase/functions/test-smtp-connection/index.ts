import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  host: string;
  port: string;
  user: string;
  password?: string;
  encryption: 'tls' | 'ssl' | 'none';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port, user, password, encryption } = await req.json() as TestRequest;

    if (!host || !port || !user) {
      throw new Error('host, port, and user are required');
    }

    // Use provided password or fallback to env
    const smtpPassword = password || Deno.env.get('SMTP_PASSWORD');
    
    if (!smtpPassword) {
      throw new Error('SMTP password is required');
    }

    console.log(`Testing SMTP connection to ${host}:${port} as ${user}`);

    const portNum = parseInt(port);

    // Configure SMTP client based on encryption
    const clientConfig: any = {
      connection: {
        hostname: host,
        port: portNum,
        auth: {
          username: user,
          password: smtpPassword,
        },
      },
    };

    // Set TLS options based on encryption type
    if (encryption === 'ssl') {
      clientConfig.connection.tls = true;
    } else if (encryption === 'tls') {
      clientConfig.connection.tls = false;
    }

    const client = new SMTPClient(clientConfig);

    // Just connecting and closing tests the credentials
    await client.close();

    console.log('SMTP connection test successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão SMTP estabelecida com sucesso' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('SMTP connection test failed:', error);
    
    let message = 'Falha na conexão SMTP';
    if (error.message.includes('authentication')) {
      message = 'Credenciais inválidas';
    } else if (error.message.includes('connection')) {
      message = 'Não foi possível conectar ao servidor';
    } else if (error.message.includes('timeout')) {
      message = 'Tempo de conexão esgotado';
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        message,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
