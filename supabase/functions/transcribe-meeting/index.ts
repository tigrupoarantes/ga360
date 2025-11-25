import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Update transcription status to processing
    await supabase
      .from('meeting_transcriptions')
      .update({ status: 'processing' })
      .eq('meeting_id', meetingId);

    // Convert base64 to audio buffer
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    // Call Lovable AI for transcription using Whisper
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create form data for audio file
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
