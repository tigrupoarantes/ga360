import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Send2FARequest {
  userId: string;
  method: "email" | "whatsapp";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, method }: Send2FARequest = await req.json();

    if (!userId || !method) {
      return new Response(
        JSON.stringify({ error: "userId e method são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📧 Enviando código 2FA via ${method} para userId: ${userId}`);

    // Buscar informações do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      console.error("Erro ao buscar usuário:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email;
    
    // Buscar perfil para obter nome e telefone
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .single();

    const userName = profile?.first_name || "Usuário";
    const userPhone = profile?.phone;

    // Verificar se WhatsApp é possível
    if (method === "whatsapp" && !userPhone) {
      return new Response(
        JSON.stringify({ error: "Telefone não cadastrado para envio via WhatsApp" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidar códigos anteriores não utilizados
    await supabase
      .from("two_factor_codes")
      .delete()
      .eq("user_id", userId)
      .eq("verified", false);

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    // Salvar código no banco
    const { error: insertError } = await supabase
      .from("two_factor_codes")
      .insert({
        user_id: userId,
        code,
        method,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Erro ao salvar código:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar código de verificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enviar código
    if (method === "email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        return new Response(
          JSON.stringify({ error: "Serviço de email não configurado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resend = new Resend(resendApiKey);
      
      const emailResponse = await resend.emails.send({
        from: "GA 360 <onboarding@resend.dev>",
        to: [userEmail!],
        subject: "Seu código de verificação - GA 360",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin-bottom: 10px;">GA 360</h1>
              <p style="color: #666;">Gestão Estratégica Integrada</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
              <p style="color: rgba(255,255,255,0.9); margin: 0 0 15px 0; font-size: 16px;">Seu código de verificação é:</p>
              <div style="background: white; border-radius: 12px; padding: 20px; display: inline-block;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
              </div>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <p style="color: #333; margin: 0 0 10px 0;">Olá, ${userName}!</p>
              <p style="color: #666; margin: 0;">Este código expira em <strong>5 minutos</strong>.</p>
              <p style="color: #666; margin: 10px 0 0 0;">Se você não solicitou este código, ignore este email.</p>
            </div>
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Este é um email automático. Por favor, não responda.
            </p>
          </div>
        `,
      });

      console.log("Email enviado:", emailResponse);
    } else if (method === "whatsapp") {
      // Buscar configuração de WhatsApp
      const { data: whatsappConfig } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_config")
        .single();

      if (!whatsappConfig?.value) {
        return new Response(
          JSON.stringify({ error: "WhatsApp não configurado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = whatsappConfig.value as any;
      const message = `🔐 *GA 360 - Código de Verificação*\n\nOlá, ${userName}!\n\nSeu código de verificação é: *${code}*\n\n⏱️ Este código expira em 5 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.`;

      if (config.provider === "twilio") {
        const accountSid = config.accountSid;
        const authToken = config.authToken;
        const fromNumber = config.whatsappNumber;

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: `whatsapp:${userPhone}`,
              From: `whatsapp:${fromNumber}`,
              Body: message,
            }),
          }
        );

        const result = await response.json();
        console.log("WhatsApp Twilio enviado:", result);
      } else if (config.provider === "evolution") {
        const response = await fetch(`${config.url}/message/sendText/${config.instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.apiKey,
          },
          body: JSON.stringify({
            number: userPhone?.replace(/\D/g, ""),
            text: message,
          }),
        });

        const result = await response.json();
        console.log("WhatsApp Evolution enviado:", result);
      }
    }

    // Mascarar email/telefone para resposta
    let maskedDestination = "";
    if (method === "email" && userEmail) {
      const [localPart, domain] = userEmail.split("@");
      maskedDestination = `${localPart.slice(0, 2)}***@${domain}`;
    } else if (method === "whatsapp" && userPhone) {
      maskedDestination = `***${userPhone.slice(-4)}`;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Código enviado via ${method}`,
        destination: maskedDestination,
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro em send-2fa-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
