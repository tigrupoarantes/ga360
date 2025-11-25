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
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch meeting data and transcription
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        *,
        meeting_transcriptions(content),
        meeting_rooms(name, company, team),
        profiles!meetings_created_by_fkey(first_name, last_name)
      `)
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found');
    }

    const transcription = meeting.meeting_transcriptions?.[0]?.content;
    if (!transcription) {
      throw new Error('Transcription not found for this meeting');
    }

    // Call Lovable AI to generate ATA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Você é um assistente especializado em gerar atas de reunião (ATAs) corporativas. 
Analise a transcrição fornecida e extraia informações estruturadas.`;

    const userPrompt = `Analise esta transcrição de reunião e extraia:

**REUNIÃO:** ${meeting.title}
**TIPO:** ${meeting.type}
**DATA:** ${new Date(meeting.scheduled_at).toLocaleString('pt-BR')}

**TRANSCRIÇÃO:**
${transcription}

Por favor, extraia e retorne um JSON com:
1. "summary": Resumo executivo em 2-3 parágrafos
2. "decisions": Array de decisões tomadas (strings)
3. "action_items": Array de objetos com { "task": string, "responsible": string (nome mencionado ou "Não definido"), "deadline": string (data mencionada ou "A definir") }
4. "content": ATA completa formatada em markdown

Retorne APENAS o JSON, sem texto adicional.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LLM error:', error);
      throw new Error('Failed to generate ATA');
    }

    const result = await response.json();
    const ataContent = result.choices[0].message.content;
    
    // Parse the JSON response
    let ataData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = ataContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        ataData = JSON.parse(jsonMatch[0]);
      } else {
        ataData = JSON.parse(ataContent);
      }
    } catch (parseError) {
      console.error('Failed to parse ATA JSON:', ataContent);
      throw new Error('Failed to parse ATA response');
    }

    // Save ATA to database
    const { data: ata, error: ataError } = await supabase
      .from('meeting_atas')
      .insert({
        meeting_id: meetingId,
        summary: ataData.summary,
        decisions: ataData.decisions,
        action_items: ataData.action_items,
        content: ataData.content,
        status: 'draft',
      })
      .select()
      .single();

    if (ataError) {
      console.error('Error saving ATA:', ataError);
      throw new Error('Failed to save ATA');
    }

    // Create tasks from action items
    const tasksToInsert = ataData.action_items.map((item: any) => ({
      meeting_id: meetingId,
      ata_id: ata.id,
      title: item.task,
      description: `Responsável sugerido: ${item.responsible}\nPrazo sugerido: ${item.deadline}`,
      priority: 'medium',
      status: 'pending',
    }));

    if (tasksToInsert.length > 0) {
      const { error: tasksError } = await supabase
        .from('meeting_tasks')
        .insert(tasksToInsert);

      if (tasksError) {
        console.error('Error creating tasks:', tasksError);
      }
    }

    console.log('ATA generated successfully for meeting:', meetingId);

    return new Response(
      JSON.stringify({ success: true, ata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-ata:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
