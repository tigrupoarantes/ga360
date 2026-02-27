import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AttendanceConfirmationRequest {
  meetingId: string;
  participantIds?: string[]; // Se vazio, envia para todos
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { meetingId, participantIds }: AttendanceConfirmationRequest = await req.json();

    console.log("Processing attendance confirmation for meeting:", meetingId);

    // Buscar dados da reunião
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        meeting_rooms!inner(name)
      `)
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingError) throw meetingError;

    if (!meeting) {
      return new Response(
        JSON.stringify({ message: "Meeting not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Buscar participantes
    let query = supabase
      .from("meeting_participants")
      .select(`
        id,
        user_id,
        confirmation_token,
        confirmation_status,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq("meeting_id", meetingId);

    if (participantIds && participantIds.length > 0) {
      query = query.in("user_id", participantIds);
    }

    const { data: participants, error: participantsError } = await query;

    if (participantsError) throw participantsError;

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ message: "No participants found" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Buscar emails dos participantes
    const userIds = participants.map((p) => p.user_id);
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) throw authError;

    const emailMap = new Map(
      authUsers.users
        .filter((u) => userIds.includes(u.id))
        .map((u) => [u.id, u.email])
    );

    const scheduledDate = new Date(meeting.scheduled_at);
    const formattedDate = scheduledDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const configuredPublicUrl = Deno.env.get("PUBLIC_SITE_URL");
    const appUrl = Deno.env.get("APP_URL");
    const baseUrl = (configuredPublicUrl || appUrl || "http://localhost:5173").replace(/\/$/, "");

    const emailPromises = participants.map(async (participant: any) => {
      const email = emailMap.get(participant.user_id);
      if (!email) {
        console.log(`No email found for user ${participant.user_id}`);
        return null;
      }

      const confirmUrl = `${baseUrl}/confirm-attendance?token=${participant.confirmation_token}`;

      try {
        const emailResponse = await resend.emails.send({
          from: "GA 360 <onboarding@resend.dev>",
          to: [email],
          subject: `Confirme sua presença: ${meeting.title}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #0B3D91; color: white; padding: 20px; text-align: center; }
                  .content { background: #f9f9f9; padding: 30px; }
                  .button { display: inline-block; padding: 12px 30px; background: #007A7A; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .details { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #0B3D91; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Confirmação de Presença</h1>
                  </div>
                  <div class="content">
                    <p>Olá, <strong>${participant.profiles.first_name} ${participant.profiles.last_name}</strong>!</p>
                    
                    <p>Você foi convidado(a) para participar da seguinte reunião:</p>
                    
                    <div class="details">
                      <h2 style="margin-top: 0;">${meeting.title}</h2>
                      <p><strong>📅 Data:</strong> ${formattedDate}</p>
                      <p><strong>⏱️ Duração:</strong> ${meeting.duration_minutes} minutos</p>
                      ${(meeting.meeting_rooms as any)?.name ? `<p><strong>📍 Sala:</strong> ${(meeting.meeting_rooms as any).name}</p>` : ""}
                    </div>
                    
                    <p>Por favor, confirme sua presença clicando no botão abaixo:</p>
                    
                    <div style="text-align: center;">
                      <a href="${confirmUrl}" class="button">✓ Confirmar Presença</a>
                    </div>
                    
                    <p style="margin-top: 30px; font-size: 14px; color: #666;">
                      Caso não possa comparecer, você pode <a href="${confirmUrl}&action=decline" style="color: #E53935;">declinar o convite</a>.
                    </p>
                  </div>
                  <div class="footer">
                    <p>GA 360 - Sistema de Gestão de Reuniões</p>
                    <p>Este é um email automático, por favor não responda.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });

        console.log(`Email sent to ${email}:`, emailResponse);

        // Atualizar timestamp de envio
        await supabase
          .from("meeting_participants")
          .update({ confirmation_reminder_sent_at: new Date().toISOString() })
          .eq("id", participant.id);

        return emailResponse;
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
        return null;
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r !== null).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `${successCount} email(s) sent successfully`,
        totalParticipants: participants.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-attendance-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
