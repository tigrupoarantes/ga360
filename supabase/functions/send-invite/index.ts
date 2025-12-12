import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Get email config for custom from address
    const { data: emailConfig } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'email_config')
      .single();

    const fromName = emailConfig?.value?.from_name || 'GA 360';
    const registrationUrl = `${appUrl}/auth?invite=${invite.token}`;

    // Send invitation email
    const { error: emailError } = await resend.emails.send({
      from: `${fromName} <onboarding@resend.dev>`,
      to: [email],
      subject: `Convite para ${fromName}`,
      html: `
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
            
            <p style="color: #333; line-height: 1.6;">
              Para ativar sua conta, clique no botão abaixo:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${registrationUrl}" 
                 style="background: linear-gradient(135deg, #0B3D91 0%, #007A7A 100%); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-weight: bold;
                        display: inline-block;">
                Ativar Minha Conta
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
              <a href="${registrationUrl}" style="color: #0B3D91; word-break: break-all;">
                ${registrationUrl}
              </a>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              Este convite expira em 7 dias.<br/>
              Se você não solicitou este convite, ignore este email.
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      throw new Error('Failed to send email');
    }

    console.log(`Invite email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Convite enviado com sucesso' 
      }),
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
