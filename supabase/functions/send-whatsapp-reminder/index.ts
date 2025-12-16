import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppConfig {
  enabled: boolean;
  provider: 'twilio' | 'evolution' | null;
  twilio?: {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
  };
  evolution?: {
    url: string;
    apiKey: string;
    instanceName: string;
  };
}

// Platform configuration for meeting integrations
const platformConfig = {
  teams: {
    name: 'Microsoft Teams',
    shortName: 'Teams',
  },
  zoom: {
    name: 'Zoom',
    shortName: 'Zoom',
  },
  google_meet: {
    name: 'Google Meet',
    shortName: 'Meet',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, reminderType, participants } = await req.json();
    console.log(`Sending WhatsApp reminders for meeting ${meetingId}, type: ${reminderType}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get WhatsApp configuration
    const { data: configData, error: configError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'whatsapp_config')
      .maybeSingle();

    if (configError) throw configError;

    if (!configData) {
      console.log('WhatsApp configuration not found');
      return new Response(
        JSON.stringify({ success: false, message: 'WhatsApp not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configData.value as WhatsAppConfig;

    if (!config.enabled || !config.provider) {
      console.log('WhatsApp integration is disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'WhatsApp integration disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get meeting details with platform info
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, scheduled_at, meeting_rooms(name, teams_link, platform)')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found');
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

    let successCount = 0;
    const errors: string[] = [];

    // Send WhatsApp message to each participant
    for (const participant of participants) {
      try {
        if (!participant.phone) {
          console.log(`Participant ${participant.name} has no phone number`);
          continue;
        }

        const message = reminderType === '1_hour'
          ? `🔔 *URGENTE: Reunião em 1 hora*\n\nOlá, ${participant.name}!\n\nSua reunião começa em aproximadamente 1 hora!\n\n📋 *${meeting.title}*\n📅 ${meetingDate}\n${meetingRoom ? `📍 ${meetingRoom.name} (${platformInfo.name})\n` : ''}\n_Este é um lembrete automático do sistema GA 360._`
          : `🔔 *Lembrete de Reunião*\n\nOlá, ${participant.name}!\n\nVocê tem uma reunião agendada para amanhã:\n\n📋 *${meeting.title}*\n📅 ${meetingDate}\n${meetingRoom ? `📍 ${meetingRoom.name} (${platformInfo.name})\n` : ''}\nPor favor, prepare-se para a reunião.\n\n_Este é um lembrete automático do sistema GA 360._`;

        if (config.provider === 'twilio') {
          await sendTwilioMessage(config.twilio!, participant.phone, message);
        } else if (config.provider === 'evolution') {
          await sendEvolutionMessage(config.evolution!, participant.phone, message);
        }

        successCount++;
        console.log(`WhatsApp sent to ${participant.name} (${participant.phone})`);
      } catch (error: any) {
        console.error(`Error sending WhatsApp to ${participant.name}:`, error);
        errors.push(`${participant.name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-whatsapp-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendTwilioMessage(
  config: { accountSid: string; authToken: string; whatsappNumber: string },
  to: string,
  message: string
) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  
  const body = new URLSearchParams({
    From: `whatsapp:${config.whatsappNumber}`,
    To: `whatsapp:${to}`,
    Body: message,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio API error: ${error}`);
  }

  return await response.json();
}

async function sendEvolutionMessage(
  config: { url: string; apiKey: string; instanceName: string },
  to: string,
  message: string
) {
  const url = `${config.url}/message/sendText/${config.instanceName}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.apiKey,
    },
    body: JSON.stringify({
      number: to.replace(/\D/g, ''),
      text: message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Evolution API error: ${error}`);
  }

  return await response.json();
}
