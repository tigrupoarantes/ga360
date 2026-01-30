import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OpenAIConfig {
  enabled: boolean;
  api_key: string;
  default_model: string;
  transcription_model: string;
}

async function getOpenAIConfig(supabase: any): Promise<{ apiKey: string; transcriptionModel: string }> {
  // Try to get config from database first
  const { data: settings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "openai_config")
    .single();

  const openaiConfig = settings?.value as OpenAIConfig | null;
  
  if (openaiConfig?.enabled && openaiConfig?.api_key) {
    return {
      apiKey: openaiConfig.api_key,
      transcriptionModel: openaiConfig.transcription_model || "whisper-1",
    };
  }

  // Fallback to environment variable
  const envApiKey = Deno.env.get("OPENAI_API_KEY");
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      transcriptionModel: "whisper-1",
    };
  }

  throw new Error("OpenAI não está configurado. Configure a API Key em Configurações > IA.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, audioBase64 } = await req.json();
    
    if (!meetingId || !audioBase64) {
      throw new Error('meetingId and audioBase64 are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get OpenAI configuration
    const { apiKey, transcriptionModel } = await getOpenAIConfig(supabase);

    console.log(`Using OpenAI transcription model: ${transcriptionModel}`);

    // Update transcription status to processing
    await supabase
      .from('meeting_transcriptions')
      .update({ status: 'processing' })
      .eq('meeting_id', meetingId);

    // Convert base64 to audio buffer
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    // Create form data for audio file
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', transcriptionModel);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Transcription error:', error);
      
      await supabase
        .from('meeting_transcriptions')
        .update({ status: 'failed' })
        .eq('meeting_id', meetingId);
      
      if (response.status === 401) {
        throw new Error('API Key inválida. Verifique a configuração em Configurações > IA.');
      }
      
      throw new Error('Failed to transcribe audio');
    }

    const result = await response.json();
    const transcription = result.text;

    // Save transcription to database
    await supabase
      .from('meeting_transcriptions')
      .update({
        content: transcription,
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('meeting_id', meetingId);

    console.log('Transcription completed for meeting:', meetingId);

    return new Response(
      JSON.stringify({ success: true, transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in transcribe-meeting:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
