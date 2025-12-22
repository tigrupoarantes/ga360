import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const portNum = parseInt(port);
    console.log(`Testing SMTP connection to ${host}:${portNum} as ${user} with encryption: ${encryption}`);

    // Determine if we need SSL/TLS
    const useSSL = encryption === 'ssl' || portNum === 465;
    const useTLS = encryption === 'tls' || portNum === 587;
    
    // Create connection options
    const connectOptions: Deno.ConnectTlsOptions = {
      hostname: host,
      port: portNum,
    };

    let conn: Deno.Conn;
    
    try {
      if (useSSL) {
        // For SSL (port 465), connect with TLS from the start
        console.log('Connecting with implicit SSL...');
        conn = await Deno.connectTls(connectOptions);
      } else {
        // For TLS/STARTTLS or no encryption, connect plain first
        console.log('Connecting plain...');
        conn = await Deno.connect({ hostname: host, port: portNum });
      }
      
      console.log('Connection established, reading server greeting...');
      
      // Read server greeting
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      
      if (bytesRead === null) {
        throw new Error('No response from server');
      }
      
      const greeting = new TextDecoder().decode(buffer.subarray(0, bytesRead));
      console.log('Server greeting:', greeting.trim());
      
      if (!greeting.startsWith('220')) {
        throw new Error(`Unexpected server response: ${greeting.trim()}`);
      }
      
      // Send EHLO
      const ehlo = `EHLO localhost\r\n`;
      await conn.write(new TextEncoder().encode(ehlo));
      console.log('Sent EHLO');
      
      // Read EHLO response
      const ehloBuffer = new Uint8Array(2048);
      const ehloBytesRead = await conn.read(ehloBuffer);
      
      if (ehloBytesRead === null) {
        throw new Error('No EHLO response from server');
      }
      
      const ehloResponse = new TextDecoder().decode(ehloBuffer.subarray(0, ehloBytesRead));
      console.log('EHLO response:', ehloResponse.substring(0, 200));
      
      // For STARTTLS, we would need to upgrade the connection here
      // For now, we'll try AUTH LOGIN to test credentials
      
      // Send AUTH LOGIN
      const authLogin = `AUTH LOGIN\r\n`;
      await conn.write(new TextEncoder().encode(authLogin));
      console.log('Sent AUTH LOGIN');
      
      // Read AUTH response
      const authBuffer = new Uint8Array(1024);
      const authBytesRead = await conn.read(authBuffer);
      
      if (authBytesRead !== null) {
        const authResponse = new TextDecoder().decode(authBuffer.subarray(0, authBytesRead));
        console.log('AUTH response:', authResponse.trim());
        
        // 334 means server is ready for username (base64 encoded)
        if (authResponse.startsWith('334')) {
          // Send username (base64 encoded)
          const userBase64 = btoa(user);
          await conn.write(new TextEncoder().encode(userBase64 + '\r\n'));
          console.log('Sent username');
          
          // Read response
          const userBuffer = new Uint8Array(1024);
          const userBytesRead = await conn.read(userBuffer);
          
          if (userBytesRead !== null) {
            const userResponse = new TextDecoder().decode(userBuffer.subarray(0, userBytesRead));
            console.log('Username response:', userResponse.trim());
            
            // 334 means server is ready for password
            if (userResponse.startsWith('334')) {
              // Send password (base64 encoded)
              const passBase64 = btoa(smtpPassword);
              await conn.write(new TextEncoder().encode(passBase64 + '\r\n'));
              console.log('Sent password');
              
              // Read final auth response
              const passBuffer = new Uint8Array(1024);
              const passBytesRead = await conn.read(passBuffer);
              
              if (passBytesRead !== null) {
                const passResponse = new TextDecoder().decode(passBuffer.subarray(0, passBytesRead));
                console.log('Auth result:', passResponse.trim());
                
                // 235 means authentication successful
                if (passResponse.startsWith('235')) {
                  console.log('Authentication successful!');
                  
                  // Send QUIT
                  await conn.write(new TextEncoder().encode('QUIT\r\n'));
                  conn.close();
                  
                  return new Response(
                    JSON.stringify({ 
                      success: true, 
                      message: 'Conexão SMTP estabelecida com sucesso' 
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  );
                } else if (passResponse.startsWith('535') || passResponse.includes('authentication failed')) {
                  throw new Error('Credenciais inválidas');
                } else {
                  throw new Error(`Falha na autenticação: ${passResponse.trim()}`);
                }
              }
            }
          }
        } else if (authResponse.includes('530') || authResponse.includes('STARTTLS')) {
          // Server requires STARTTLS first
          console.log('Server requires STARTTLS - connection test partial success');
          conn.close();
          
          // For servers requiring STARTTLS, we can't fully test without upgrading
          // but connection was established
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Conexão estabelecida (servidor requer STARTTLS para autenticação)' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Send QUIT and close
      await conn.write(new TextEncoder().encode('QUIT\r\n'));
      conn.close();
      
      // If we got here without explicit success, connection worked but auth wasn't tested
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Conexão SMTP estabelecida' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (connError: any) {
      console.error('Connection error:', connError);
      throw connError;
    }

  } catch (error: any) {
    console.error('SMTP connection test failed:', error);
    
    let message = 'Falha na conexão SMTP';
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('credenciais') || errorMsg.includes('authentication') || errorMsg.includes('535')) {
      message = 'Credenciais inválidas';
    } else if (errorMsg.includes('connection refused') || errorMsg.includes('connect')) {
      message = 'Não foi possível conectar ao servidor - verifique host e porta';
    } else if (errorMsg.includes('timeout')) {
      message = 'Tempo de conexão esgotado';
    } else if (errorMsg.includes('certificate') || errorMsg.includes('ssl') || errorMsg.includes('tls')) {
      message = 'Erro de certificado SSL/TLS - verifique configuração de criptografia';
    } else if (errorMsg.includes('no response')) {
      message = 'Servidor não respondeu';
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
