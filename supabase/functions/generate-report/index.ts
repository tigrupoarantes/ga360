import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um analista de dados corporativos especializado em gerar relatórios executivos para o sistema GA 360 do Grupo Arantes.

Você tem acesso aos dados do sistema e deve gerar relatórios claros, objetivos e com insights acionáveis.

Ao gerar relatórios:
1. Use formatação Markdown clara e profissional
2. Inclua métricas numéricas sempre que possível
3. Destaque tendências e insights relevantes
4. Use emojis para tornar visual (📊 📈 ✅ ⚠️ 📅 👥)
5. Organize em seções claras com títulos
6. Sugira ações baseadas nos dados quando relevante
7. Inclua tabelas para dados tabulares
8. Seja conciso mas completo

Para gráficos, use este formato especial que será parseado:
<!-- CHART:bar title="Título do Gráfico" -->
| Categoria | Valor |
|-----------|-------|
| Item 1 | 10 |
| Item 2 | 20 |
<!-- /CHART -->

Tipos de gráfico suportados: bar, pie, line

Responda sempre em português brasileiro.`;

interface OpenAIConfig {
  enabled: boolean;
  api_key: string;
  default_model: string;
  transcription_model: string;
}

async function getOpenAIConfig(supabase: any): Promise<{ apiKey: string; model: string }> {
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
      model: openaiConfig.default_model || "gpt-4o",
    };
  }

  // Fallback to environment variable
  const envApiKey = Deno.env.get("OPENAI_API_KEY");
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      model: "gpt-4o",
    };
  }

  throw new Error("OpenAI não está configurado. Configure a API Key em Configurações > IA.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, filters } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OpenAI configuration
    const { apiKey, model } = await getOpenAIConfig(supabase);

    console.log(`Using OpenAI model: ${model}`);
    console.log("Fetching data for report generation...");

    // Fetch relevant data in parallel
    const [
      meetingsResult,
      tasksResult,
      atasResult,
      companiesResult,
      areasResult,
      participantsResult,
      profilesResult
    ] = await Promise.all([
      supabase
        .from("meetings")
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(100),
      supabase
        .from("meeting_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("meeting_atas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("companies")
        .select("*"),
      supabase
        .from("areas")
        .select("*"),
      supabase
        .from("meeting_participants")
        .select("*")
        .limit(500),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, company_id, area_id, is_active")
    ]);

    // Build context with fetched data
    const dataContext = {
      meetings: meetingsResult.data || [],
      tasks: tasksResult.data || [],
      atas: atasResult.data || [],
      companies: companiesResult.data || [],
      areas: areasResult.data || [],
      participants: participantsResult.data || [],
      profiles: profilesResult.data || [],
      currentDate: new Date().toISOString().split("T")[0],
    };

    // Calculate summary statistics
    const stats = {
      totalMeetings: dataContext.meetings.length,
      meetingsByStatus: dataContext.meetings.reduce((acc: Record<string, number>, m: any) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
      }, {}),
      meetingsByType: dataContext.meetings.reduce((acc: Record<string, number>, m: any) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {}),
      totalTasks: dataContext.tasks.length,
      tasksByStatus: dataContext.tasks.reduce((acc: Record<string, number>, t: any) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {}),
      tasksByPriority: dataContext.tasks.reduce((acc: Record<string, number>, t: any) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {}),
      totalAtas: dataContext.atas.length,
      atasByStatus: dataContext.atas.reduce((acc: Record<string, number>, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {}),
      totalCompanies: dataContext.companies.length,
      totalAreas: dataContext.areas.length,
      totalProfiles: dataContext.profiles.length,
      activeProfiles: dataContext.profiles.filter((p: any) => p.is_active).length,
    };

    // Build user prompt with context
    const userPrompt = `
Data atual: ${dataContext.currentDate}

## Dados Disponíveis do Sistema GA 360

### Estatísticas Gerais:
- Total de Reuniões: ${stats.totalMeetings}
- Reuniões por Status: ${JSON.stringify(stats.meetingsByStatus)}
- Reuniões por Tipo: ${JSON.stringify(stats.meetingsByType)}
- Total de Tarefas: ${stats.totalTasks}
- Tarefas por Status: ${JSON.stringify(stats.tasksByStatus)}
- Tarefas por Prioridade: ${JSON.stringify(stats.tasksByPriority)}
- Total de ATAs: ${stats.totalAtas}
- ATAs por Status: ${JSON.stringify(stats.atasByStatus)}
- Empresas: ${stats.totalCompanies}
- Áreas: ${stats.totalAreas}
- Usuários Ativos: ${stats.activeProfiles}/${stats.totalProfiles}

### Empresas:
${JSON.stringify(dataContext.companies.map((c: any) => ({ id: c.id, name: c.name })), null, 2)}

### Áreas:
${JSON.stringify(dataContext.areas.map((a: any) => ({ id: a.id, name: a.name, company_id: a.company_id })), null, 2)}

### Últimas 20 Reuniões:
${JSON.stringify(dataContext.meetings.slice(0, 20).map((m: any) => ({
  title: m.title,
  type: m.type,
  status: m.status,
  scheduled_at: m.scheduled_at,
  area_id: m.area_id
})), null, 2)}

### Últimas 30 Tarefas:
${JSON.stringify(dataContext.tasks.slice(0, 30).map((t: any) => ({
  title: t.title,
  status: t.status,
  priority: t.priority,
  due_date: t.due_date,
  meeting_id: t.meeting_id
})), null, 2)}

### Confirmações de Participação (amostra):
${JSON.stringify(dataContext.participants.slice(0, 50).map((p: any) => ({
  meeting_id: p.meeting_id,
  confirmation_status: p.confirmation_status,
  attended: p.attended
})), null, 2)}

---

## Solicitação do Usuário:
${query}

${filters ? `Filtros aplicados: ${JSON.stringify(filters)}` : ''}

Por favor, gere um relatório completo e profissional baseado na solicitação acima, usando os dados disponíveis.`;

    console.log("Calling OpenAI API for report generation...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "API Key inválida. Verifique a configuração em Configurações > IA." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error in generate-report function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
