import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Platform configuration for meeting integrations
const platformConfig = {
  teams: {
    name: 'Microsoft Teams',
    shortName: 'Teams',
    color: '#0078D4',
  },
  zoom: {
    name: 'Zoom',
    shortName: 'Zoom',
    color: '#2D8CFF',
  },
  google_meet: {
    name: 'Google Meet',
    shortName: 'Meet',
    color: '#00897B',
  },
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // ── Auth: verificar x-cron-secret para impedir acionamento anônimo ──
  const cronSecret = Deno.env.get('CRON_SECRET');
  const incomingSecret = req.headers.get('x-cron-secret');
  if (cronSecret && incomingSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Starting meeting reminders check...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if WhatsApp is enabled
    const { data: whatsappConfig } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .maybeSingle();

    const whatsappEnabled = whatsappConfig?.value?.enabled || false;

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find meetings that need 1-day reminders (scheduled between now and 24 hours from now)
    const { data: oneDayMeetings, error: oneDayError } = await supabase
      .from('meetings')
      .select('id, title, scheduled_at, meeting_rooms(name, teams_link, platform)')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', oneDayFromNow.toISOString())
      .eq('status', 'Agendada');

    if (oneDayError) {
      console.error('Error fetching 1-day meetings:', oneDayError);
    }

    // Find meetings that need 1-hour reminders (scheduled between now and 1 hour from now)
    const { data: oneHourMeetings, error: oneHourError } = await supabase
      .from('meetings')
      .select('id, title, scheduled_at, meeting_rooms(name, teams_link, platform)')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', oneHourFromNow.toISOString())
      .eq('status', 'Agendada');

    if (oneHourError) {
      console.error('Error fetching 1-hour meetings:', oneHourError);
    }

    const results = {
      oneDayReminders: 0,
      oneHourReminders: 0,
      errors: [] as string[]
    };

    // Process 1-day reminders
    if (oneDayMeetings && oneDayMeetings.length > 0) {
      for (const meeting of oneDayMeetings) {
        try {
          // Check if reminder already sent
          const { data: existingReminder } = await supabase
            .from('meeting_reminders')
            .select('id')
            .eq('meeting_id', meeting.id)
            .eq('reminder_type', '1_day')
            .maybeSingle();

          if (existingReminder) {
            console.log(`1-day reminder already sent for meeting ${meeting.id}`);
            continue;
          }

          // Get participants with phone numbers
          const { data: participants, error: participantsError } = await supabase
            .from('meeting_participants')
            .select('user_id, profiles(id, first_name, last_name, phone)')
            .eq('meeting_id', meeting.id);

          if (participantsError || !participants || participants.length === 0) {
            console.log(`No participants found for meeting ${meeting.id}`);
            continue;
          }

          // Get participant emails
          const emailPromises = participants.map(async (participant: any) => {
            const { data: { user }, error } = await supabase.auth.admin.getUserById(participant.user_id);
            if (error || !user?.email) return null;
            
            return {
              email: user.email,
              name: `${participant.profiles.first_name} ${participant.profiles.last_name}`,
              phone: participant.profiles.phone,
            };
          });

          const emailsData = await Promise.all(emailPromises);
          const validEmails = emailsData.filter(item => item !== null);

          if (validEmails.length === 0) {
            console.log(`No valid emails found for meeting ${meeting.id}`);
            continue;
          }

          const meetingDate = new Date(meeting.scheduled_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const meetingRoom = meeting.meeting_rooms?.[0];
          const platform = meetingRoom?.platform || 'teams';
          const platformInfo = platformConfig[platform as keyof typeof platformConfig] || platformConfig.teams;

          // Send emails
          const emailResults = await Promise.allSettled(
            validEmails.map(({ email, name }) => 
              resend.emails.send({
                from: 'GA 360 <onboarding@resend.dev>',
                to: [email],
                subject: `Lembrete: Reunião amanhã - ${meeting.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #0B3D91 0%, #007A7A 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">GA 360</h1>
                    </div>
                    
                    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <h2 style="color: #0B3D91; margin-top: 0;">Olá, ${name}!</h2>
                      
                      <p style="color: #333; line-height: 1.6; font-size: 16px;">
                        <strong>⏰ Lembrete:</strong> Você tem uma reunião agendada para amanhã:
                      </p>
                      
                      <div style="background: #f6f7f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
                        <h3 style="color: #0B3D91; margin-top: 0;">${meeting.title}</h3>
                        <p style="color: #666; margin: 10px 0;">
                          <strong>📅 Data e Hora:</strong><br/>
                          ${meetingDate}
                        </p>
                        ${meetingRoom ? `
                          <p style="color: #666; margin: 10px 0;">
                            <strong>📍 Local:</strong><br/>
                            ${meetingRoom.name} (${platformInfo.name})
                          </p>
                        ` : ''}
                      </div>
                      
                      <p style="color: #333; line-height: 1.6;">
                        Por favor, prepare-se para a reunião e confirme sua presença.
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
              })
            )
          );

          const successful = emailResults.filter(r => r.status === 'fulfilled').length;
          
          if (successful > 0) {
            // Mark reminder as sent
            await supabase
              .from('meeting_reminders')
              .insert({
                meeting_id: meeting.id,
                reminder_type: '1_day'
              });

            results.oneDayReminders += successful;
            console.log(`Sent ${successful} 1-day reminders for meeting ${meeting.id}`);

            // Send WhatsApp reminders if enabled
            if (whatsappEnabled) {
              const participantsWithPhone = validEmails.filter(p => p.phone);
              if (participantsWithPhone.length > 0) {
                try {
                  await supabase.functions.invoke('send-whatsapp-reminder', {
                    body: {
                      meetingId: meeting.id,
                      reminderType: '1_day',
                      participants: participantsWithPhone,
                    }
                  });
                  console.log(`WhatsApp reminders sent for meeting ${meeting.id}`);
                } catch (whatsappError) {
                  console.error('Error sending WhatsApp reminders:', whatsappError);
                }
              }
            }
          }
        } catch (error: any) {
          console.error(`Error processing 1-day reminder for meeting ${meeting.id}:`, error);
          results.errors.push(`Meeting ${meeting.id}: ${error.message}`);
        }
      }
    }

    // Process 1-hour reminders
    if (oneHourMeetings && oneHourMeetings.length > 0) {
      for (const meeting of oneHourMeetings) {
        try {
          // Check if reminder already sent
          const { data: existingReminder } = await supabase
            .from('meeting_reminders')
            .select('id')
            .eq('meeting_id', meeting.id)
            .eq('reminder_type', '1_hour')
            .maybeSingle();

          if (existingReminder) {
            console.log(`1-hour reminder already sent for meeting ${meeting.id}`);
            continue;
          }

          // Get participants with phone numbers
          const { data: participants, error: participantsError } = await supabase
            .from('meeting_participants')
            .select('user_id, profiles(id, first_name, last_name, phone)')
            .eq('meeting_id', meeting.id);

          if (participantsError || !participants || participants.length === 0) {
            console.log(`No participants found for meeting ${meeting.id}`);
            continue;
          }

          // Get participant emails
          const emailPromises = participants.map(async (participant: any) => {
            const { data: { user }, error } = await supabase.auth.admin.getUserById(participant.user_id);
            if (error || !user?.email) return null;
            
            return {
              email: user.email,
              name: `${participant.profiles.first_name} ${participant.profiles.last_name}`,
              phone: participant.profiles.phone,
            };
          });

          const emailsData = await Promise.all(emailPromises);
          const validEmails = emailsData.filter(item => item !== null);

          if (validEmails.length === 0) {
            console.log(`No valid emails found for meeting ${meeting.id}`);
            continue;
          }

          const meetingDate = new Date(meeting.scheduled_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const meetingRoom = meeting.meeting_rooms?.[0];
          const platform = meetingRoom?.platform || 'teams';
          const platformInfo = platformConfig[platform as keyof typeof platformConfig] || platformConfig.teams;

          // Send emails
          const emailResults = await Promise.allSettled(
            validEmails.map(({ email, name }) => 
              resend.emails.send({
                from: 'GA 360 <onboarding@resend.dev>',
                to: [email],
                subject: `🔔 URGENTE: Reunião em 1 hora - ${meeting.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #E53935 0%, #FFB400 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">🔔 GA 360 - REUNIÃO EM BREVE</h1>
                    </div>
                    
                    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <h2 style="color: #E53935; margin-top: 0;">Olá, ${name}!</h2>
                      
                      <p style="color: #333; line-height: 1.6; font-size: 16px;">
                        <strong>⚠️ ATENÇÃO:</strong> Sua reunião começa em aproximadamente 1 hora!
                      </p>
                      
                      <div style="background: #fff3cd; border-left: 4px solid #FFB400; padding: 20px; border-radius: 6px; margin: 20px 0;">
                        <h3 style="color: #0B3D91; margin-top: 0;">${meeting.title}</h3>
                        <p style="color: #666; margin: 10px 0;">
                          <strong>📅 Data e Hora:</strong><br/>
                          ${meetingDate}
                        </p>
                        ${meetingRoom ? `
                          <p style="color: #666; margin: 10px 0;">
                            <strong>📍 Local:</strong><br/>
                            ${meetingRoom.name} (${platformInfo.name})
                          </p>
                          ${meetingRoom.teams_link ? `
                            <p style="margin: 20px 0;">
                              <a href="${meetingRoom.teams_link}" 
                                 style="background: ${platformInfo.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                                🔗 Entrar via ${platformInfo.shortName}
                              </a>
                            </p>
                          ` : ''}
                        ` : ''}
                      </div>
                      
                      <p style="color: #333; line-height: 1.6;">
                        Por favor, conecte-se alguns minutos antes do horário de início.
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
              })
            )
          );

          const successful = emailResults.filter(r => r.status === 'fulfilled').length;
          
          if (successful > 0) {
            // Mark reminder as sent
            await supabase
              .from('meeting_reminders')
              .insert({
                meeting_id: meeting.id,
                reminder_type: '1_hour'
              });

            results.oneHourReminders += successful;
            console.log(`Sent ${successful} 1-hour reminders for meeting ${meeting.id}`);

            // Send WhatsApp reminders if enabled
            if (whatsappEnabled) {
              const participantsWithPhone = validEmails.filter(p => p.phone);
              if (participantsWithPhone.length > 0) {
                try {
                  await supabase.functions.invoke('send-whatsapp-reminder', {
                    body: {
                      meetingId: meeting.id,
                      reminderType: '1_hour',
                      participants: participantsWithPhone,
                    }
                  });
                  console.log(`WhatsApp reminders sent for meeting ${meeting.id}`);
                } catch (whatsappError) {
                  console.error('Error sending WhatsApp reminders:', whatsappError);
                }
              }
            }
          }
        } catch (error: any) {
          console.error(`Error processing 1-hour reminder for meeting ${meeting.id}:`, error);
          results.errors.push(`Meeting ${meeting.id}: ${error.message}`);
        }
      }
    }

    console.log('Reminder check complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true,
        ...results,
        message: `Sent ${results.oneDayReminders} 1-day reminders and ${results.oneHourReminders} 1-hour reminders` 
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-meeting-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
