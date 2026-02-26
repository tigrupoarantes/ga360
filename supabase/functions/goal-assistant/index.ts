// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIProviderConfig {
  enabled: boolean;
  api_key: string;
  default_model: string;
  goal_provider?: "openai" | "gemini";
  gemini_api_key?: string;
  gemini_model?: string;
}

interface OpenAIApiErrorPayload {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

type AgentRole = "user" | "assistant" | "tool";

type ToolName =
  | "create_goal"
  | "create_goal_activity"
  | "update_goal"
  | "update_goal_progress"
  | "deactivate_goal"
  | "complete_goal_activity"
  | "query_goals";

interface RequestBody {
  companyId: string;
  message: string;
}

interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const SYSTEM_PROMPT = `Você é o Agente de Metas do GA 360.

Regras obrigatórias:
1) Sempre operar somente dentro da company_id autorizada para este usuário.
2) Quando precisar criar/editar/consultar dados, use as tools disponíveis.
3) Nunca invente IDs. Consulte antes, quando necessário.
4) Responda em português brasileiro de forma objetiva.
5) Quando realizar alterações, descreva claramente o que foi feito.
6) Se faltar dado essencial, faça uma pergunta de esclarecimento curta.
`;

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "create_goal",
      description: "Cria uma nova meta no portal de metas",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["numeric", "activity", "hybrid"] },
          pillar: { type: ["string", "null"], enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG", null] },
          unit: { type: ["string", "null"] },
          target_value: { type: ["number", "null"] },
          current_value: { type: "number" },
          cadence: { type: "string", enum: ["monthly", "activity", "quarterly", "annual"] },
          start_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          end_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          area_id: { type: ["string", "null"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_goal_activity",
      description: "Cria atividade vinculada a uma meta",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          weight: { type: "number" },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
        },
        required: ["goal_id", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_goal",
      description: "Atualiza campos de uma meta existente",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          status: { type: "string", enum: ["active", "completed", "paused", "cancelled"] },
          target_value: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          end_date: { type: ["string", "null"] },
          area_id: { type: ["string", "null"] },
          cadence: { type: "string", enum: ["monthly", "activity", "quarterly", "annual"] },
          pillar: { type: ["string", "null"], enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG", null] },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_goal_progress",
      description: "Atualiza o progresso numérico da meta (current_value)",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
          current_value: { type: "number" },
        },
        required: ["goal_id", "current_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deactivate_goal",
      description: "Desativa uma meta alterando status para cancelled",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string" },
        },
        required: ["goal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_goal_activity",
      description: "Marca uma atividade como concluída",
      parameters: {
        type: "object",
        properties: {
          activity_id: { type: "string" },
        },
        required: ["activity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_goals",
      description: "Consulta metas da empresa com filtros opcionais",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" },
          status: { type: "string", enum: ["active", "completed", "paused", "cancelled"] },
          limit: { type: "number" },
        },
      },
    },
  },
];

async function getAIProviderConfig(
  supabaseAdmin: any
): Promise<{ provider: "openai" | "gemini"; apiKey: string; model: string; endpoint: string }> {
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "openai_config")
    .single();

  const aiConfig = settings?.value as AIProviderConfig | null;
  const hasOpenAIKey = Boolean(aiConfig?.api_key) || Boolean(Deno.env.get("OPENAI_API_KEY"));
  const hasGeminiKey = Boolean(aiConfig?.gemini_api_key) || Boolean(Deno.env.get("GEMINI_API_KEY"));

  const selectedProvider =
    aiConfig?.goal_provider === "gemini"
      ? "gemini"
      : aiConfig?.goal_provider === "openai"
      ? "openai"
      : hasGeminiKey && !hasOpenAIKey
      ? "gemini"
      : "openai";

  if (selectedProvider === "gemini") {
    const geminiKey = aiConfig?.gemini_api_key || Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("Gemini não está configurado para o copiloto de metas.");
    }

    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: aiConfig?.gemini_model || "gemini-2.0-flash-lite",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    };
  }

  if (aiConfig?.enabled && aiConfig?.api_key) {
    return {
      provider: "openai",
      apiKey: aiConfig.api_key,
      model: aiConfig.default_model || "gpt-4o",
      endpoint: "https://api.openai.com/v1/chat/completions",
    };
  }

  if (aiConfig?.enabled && aiConfig?.gemini_api_key) {
    return {
      provider: "gemini",
      apiKey: aiConfig.gemini_api_key,
      model: aiConfig.gemini_model || "gemini-2.0-flash-lite",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    };
  }

  const envApiKey = Deno.env.get("OPENAI_API_KEY");
  if (envApiKey) {
    return {
      provider: "openai",
      apiKey: envApiKey,
      model: "gpt-4o",
      endpoint: "https://api.openai.com/v1/chat/completions",
    };
  }

  throw new Error("Nenhum provedor de IA configurado (OpenAI/Gemini).");
}

function buildModelCandidates(provider: "openai" | "gemini", configuredModel: string) {
  const normalizedConfigured = String(configuredModel || "gpt-4o").trim();
  const candidates =
    provider === "gemini"
      ? [normalizedConfigured, "gemini-2.0-flash-lite", "gemini-2.0-flash"]
      : [normalizedConfigured, "gpt-4o-mini", "gpt-4o"];

  return [...new Set(candidates)];
}

async function createChatCompletionWithFallback(params: {
  provider: "openai" | "gemini";
  apiKey: string;
  model: string;
  endpoint: string;
  messages: any[];
}) {
  const modelCandidates = buildModelCandidates(params.provider, params.model);
  let lastErrorMessage = "Falha ao consultar provedor de IA";

  for (const candidateModel of modelCandidates) {
    const openaiRes = await fetch(params.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidateModel,
        messages: params.messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (openaiRes.ok) {
      return openaiRes.json();
    }

    const errorBodyText = await openaiRes.text();
    let parsedError: OpenAIApiErrorPayload | null = null;
    try {
      parsedError = JSON.parse(errorBodyText) as OpenAIApiErrorPayload;
    } catch {
      parsedError = null;
    }

    const apiMessage = parsedError?.error?.message || errorBodyText || `HTTP ${openaiRes.status}`;
    const providerName = params.provider === "gemini" ? "Gemini" : "OpenAI";
    lastErrorMessage = `${providerName} (${candidateModel}) retornou ${openaiRes.status}: ${apiMessage}`;

    const isRetryableModelError =
      openaiRes.status === 400 ||
      openaiRes.status === 404 ||
      parsedError?.error?.code === "model_not_found" ||
      (parsedError?.error?.message || "").toLowerCase().includes("model");

    if (isRetryableModelError && candidateModel !== modelCandidates[modelCandidates.length - 1]) {
      console.warn("Fallback de modelo IA acionado", {
        provider: params.provider,
        attempted_model: candidateModel,
        status: openaiRes.status,
      });
      continue;
    }

    throw new Error(lastErrorMessage);
  }

  throw new Error(lastErrorMessage);
}

async function saveMessage(
  supabaseAdmin: any,
  params: {
    companyId: string;
    userId: string;
    role: AgentRole;
    content: string;
    toolCalls?: unknown;
    toolName?: string;
  }
) {
  const { error } = await supabaseAdmin.from("goal_agent_messages").insert({
    company_id: params.companyId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
    tool_calls: params.toolCalls ?? null,
    tool_name: params.toolName ?? null,
  });

  if (error) {
    console.error("Erro ao persistir mensagem:", error);
  }
}

async function assertCompanyAccess(supabaseAdmin: any, userId: string, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_companies")
    .select("company_id, all_companies")
    .eq("user_id", userId);

  if (error) throw error;

  const allCompanies = (data || []).some((row: any) => row.all_companies === true);
  const hasSpecific = (data || []).some((row: any) => row.company_id === companyId);

  if (!allCompanies && !hasSpecific) {
    throw new Error("Usuário sem acesso à empresa informada.");
  }
}

async function ensureGoalInCompany(supabaseAdmin: any, goalId: string, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Meta não encontrada na empresa selecionada.");
}

async function getUserModulePermission(
  supabaseAdmin: any,
  userId: string,
  module: string
): Promise<ModulePermission> {
  const { data: roles, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) throw roleError;

  const isSuperAdmin = (roles || []).some((item: any) => item.role === "super_admin");
  if (isSuperAdmin) {
    return {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
    };
  }

  const { data: permission, error: permissionError } = await supabaseAdmin
    .from("user_permissions")
    .select("can_view, can_create, can_edit, can_delete")
    .eq("user_id", userId)
    .eq("module", module)
    .maybeSingle();

  if (permissionError) throw permissionError;

  return {
    can_view: permission?.can_view ?? false,
    can_create: permission?.can_create ?? false,
    can_edit: permission?.can_edit ?? false,
    can_delete: permission?.can_delete ?? false,
  };
}

function assertToolPermission(toolName: ToolName, permission: ModulePermission) {
  if (toolName === "query_goals" && !permission.can_view) {
    throw new Error("Sem permissão para visualizar metas.");
  }

  if ((toolName === "create_goal" || toolName === "create_goal_activity") && !permission.can_create) {
    throw new Error("Sem permissão para criar no módulo de metas.");
  }

  if (
    (toolName === "update_goal" ||
      toolName === "update_goal_progress" ||
      toolName === "complete_goal_activity") &&
    !permission.can_edit
  ) {
    throw new Error("Sem permissão para editar no módulo de metas.");
  }

  if (toolName === "deactivate_goal" && !permission.can_delete) {
    throw new Error("Sem permissão para desativar metas.");
  }
}

async function executeTool(
  supabaseAdmin: any,
  companyId: string,
  toolName: ToolName,
  rawArgs: string,
  permission: ModulePermission
): Promise<unknown> {
  assertToolPermission(toolName, permission);
  const args = rawArgs ? JSON.parse(rawArgs) : {};

  switch (toolName) {
    case "create_goal": {
      const payload = {
        company_id: companyId,
        title: String(args.title || "").trim(),
        description: args.description ?? null,
        type: args.type ?? "numeric",
        pillar: args.pillar ?? null,
        unit: args.unit ?? null,
        target_value: args.target_value ?? null,
        current_value: args.current_value ?? 0,
        cadence: args.cadence ?? "monthly",
        start_date: args.start_date ?? null,
        end_date: args.end_date ?? null,
        area_id: args.area_id ?? null,
      };

      if (!payload.title) throw new Error("Título da meta é obrigatório.");

      const { data, error } = await supabaseAdmin
        .from("goals")
        .insert(payload)
        .select("id, title, status, current_value, target_value")
        .single();
      if (error) throw error;
      return data;
    }

    case "create_goal_activity": {
      await ensureGoalInCompany(supabaseAdmin, args.goal_id, companyId);

      const payload = {
        goal_id: args.goal_id,
        title: String(args.title || "").trim(),
        description: args.description ?? null,
        weight: args.weight ?? 1,
        due_date: args.due_date ?? null,
      };

      if (!payload.title) throw new Error("Título da atividade é obrigatório.");

      const { data, error } = await supabaseAdmin
        .from("goal_activities")
        .insert(payload)
        .select("id, goal_id, title, status, due_date")
        .single();
      if (error) throw error;
      return data;
    }

    case "update_goal": {
      await ensureGoalInCompany(supabaseAdmin, args.goal_id, companyId);

      const updatePayload: Record<string, unknown> = {};
      const fields = [
        "title",
        "description",
        "status",
        "target_value",
        "unit",
        "end_date",
        "area_id",
        "cadence",
        "pillar",
      ];

      for (const field of fields) {
        if (field in args) updatePayload[field] = args[field];
      }

      if (Object.keys(updatePayload).length === 0) {
        throw new Error("Nenhum campo informado para atualização.");
      }

      const { data, error } = await supabaseAdmin
        .from("goals")
        .update(updatePayload)
        .eq("id", args.goal_id)
        .eq("company_id", companyId)
        .select("id, title, status, current_value, target_value")
        .single();
      if (error) throw error;
      return data;
    }

    case "update_goal_progress": {
      await ensureGoalInCompany(supabaseAdmin, args.goal_id, companyId);

      const { data, error } = await supabaseAdmin
        .from("goals")
        .update({ current_value: args.current_value })
        .eq("id", args.goal_id)
        .eq("company_id", companyId)
        .select("id, title, current_value, target_value")
        .single();
      if (error) throw error;
      return data;
    }

    case "deactivate_goal": {
      await ensureGoalInCompany(supabaseAdmin, args.goal_id, companyId);

      const { data, error } = await supabaseAdmin
        .from("goals")
        .update({ status: "cancelled" })
        .eq("id", args.goal_id)
        .eq("company_id", companyId)
        .select("id, title, status")
        .single();
      if (error) throw error;
      return data;
    }

    case "complete_goal_activity": {
      const { data: activity, error: activityError } = await supabaseAdmin
        .from("goal_activities")
        .select("id, goal_id")
        .eq("id", args.activity_id)
        .maybeSingle();

      if (activityError) throw activityError;
      if (!activity) throw new Error("Atividade não encontrada.");

      await ensureGoalInCompany(supabaseAdmin, activity.goal_id, companyId);

      const { data, error } = await supabaseAdmin
        .from("goal_activities")
        .update({ status: "completed" })
        .eq("id", args.activity_id)
        .select("id, goal_id, title, status")
        .single();
      if (error) throw error;
      return data;
    }

    case "query_goals": {
      let query = supabaseAdmin
        .from("goals")
        .select("id, title, status, current_value, target_value, unit, end_date, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (args.status) {
        query = query.eq("status", args.status);
      }

      if (args.search) {
        query = query.ilike("title", `%${String(args.search).trim()}%`);
      }

      if (args.limit) {
        query = query.limit(Math.min(Number(args.limit), 30));
      } else {
        query = query.limit(10);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    default:
      throw new Error(`Tool não suportada: ${toolName}`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json()) as RequestBody;

    if (!body.companyId || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: "companyId e message são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await assertCompanyAccess(supabaseAdmin, userId, body.companyId);
    const metasPermission = await getUserModulePermission(supabaseAdmin, userId, "metas");

    if (!metasPermission.can_view) {
      return new Response(JSON.stringify({ error: "Usuário sem permissão de acesso ao módulo metas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider, apiKey, model, endpoint } = await getAIProviderConfig(supabaseAdmin);

    await saveMessage(supabaseAdmin, {
      companyId: body.companyId,
      userId,
      role: "user",
      content: body.message.trim(),
    });

    const { data: history, error: historyError } = await supabaseAdmin
      .from("goal_agent_messages")
      .select("role, content")
      .eq("company_id", body.companyId)
      .eq("user_id", userId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(20);

    if (historyError) throw historyError;

    const messages: any[] = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\ncompany_id autorizada desta sessão: ${body.companyId}`,
      },
      ...(history || []).map((item: any) => ({
        role: item.role,
        content: item.content,
      })),
    ];

    let finalAssistantText = "";

    for (let iteration = 0; iteration < 6; iteration++) {
      const completion = await createChatCompletionWithFallback({
        provider,
        apiKey,
        model,
        endpoint,
        messages,
      });
      const assistantMessage = completion?.choices?.[0]?.message;

      if (!assistantMessage) {
        throw new Error("Resposta inválida do assistente");
      }

      const toolCalls = assistantMessage.tool_calls || [];

      if (!toolCalls.length) {
        finalAssistantText = assistantMessage.content || "";
        messages.push({ role: "assistant", content: finalAssistantText });
        break;
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const toolName = call.function.name as ToolName;
        const toolArgs = call.function.arguments as string;

        let toolResult: unknown;

        try {
          toolResult = await executeTool(supabaseAdmin, body.companyId, toolName, toolArgs, metasPermission);
        } catch (toolError: any) {
          toolResult = { error: toolError.message || "Erro ao executar tool" };
          console.error("Erro em tool", { toolName, companyId: body.companyId, userId, detail: toolError?.message });
        }

        await saveMessage(supabaseAdmin, {
          companyId: body.companyId,
          userId,
          role: "tool",
          content: JSON.stringify(toolResult),
          toolCalls: call,
          toolName,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    if (!finalAssistantText) {
      finalAssistantText = "Concluí o processamento, mas não consegui gerar uma resposta final. Pode reformular o pedido?";
    }

    await saveMessage(supabaseAdmin, {
      companyId: body.companyId,
      userId,
      role: "assistant",
      content: finalAssistantText,
    });

    return new Response(JSON.stringify({ success: true, reply: finalAssistantText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro em goal-assistant:", {
      message: error?.message,
      stack: error?.stack,
    });
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
