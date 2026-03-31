import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { meetingId, meetingTitle, meetingDate, participantIds } = await req.json();

    if (!meetingId || !participantIds || participantIds.length === 0) {
      throw new Error('meetingId and participantIds are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar emails dos participantes
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', participantIds);

    if (profilesError) throw profilesError;

    // Buscar emails do auth.users através de uma chamada admin
    const emailPromises = profiles.map(async (profile) => {
      const { data: { user }, error } = await supabase.auth.admin.getUserById(profile.id);
      if (error || !user?.email) return null;
      
      return {
        email: user.email,
        name: `${profile.first_name} ${profile.last_name}`,
      };
    });

    const emailsData = await Promise.all(emailPromises);
    const validEmails = emailsData.filter(item => item !== null);

    if (validEmails.length === 0) {
      throw new Error('No valid email addresses found for participants');
    }

    // Formatar data da reunião
    const meetingDateFormatted = new Date(meetingDate).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Enviar emails
    const emailPromisesResend = validEmails.map(async ({ email, name }) => {
      return await resend.emails.send({
        from: 'GA 360 <onboarding@resend.dev>',
        to: [email],
        subject: `Convite: ${meetingTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0B3D91 0%, #007A7A 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">GA 360</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #0B3D91; margin-top: 0;">Olá, ${name}!</h2>
              
              <p style="color: #333; line-height: 1.6;">
                Você foi adicionado como participante da seguinte reunião:
              </p>
              
              <div style="background: #f6f7f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #0B3D91; margin-top: 0;">${meetingTitle}</h3>
                <p style="color: #666; margin: 10px 0;">
                  <strong>📅 Data e Hora:</strong><br/>
                  ${meetingDateFormatted}
                </p>
              </div>
              
              <p style="color: #333; line-height: 1.6;">
                Por favor, confirme sua presença e prepare-se para a reunião.
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Esta é uma notificação automática do sistema GA 360.<br/>
                  Por favor, não responda a este email.
                </p>
              </div>
            </div>
          </div>
        `,
      });
    });

    const results = await Promise.allSettled(emailPromisesResend);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Emails sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful,
        failed: failed,
        message: `${successful} email(s) enviado(s) com sucesso` 
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-meeting-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
