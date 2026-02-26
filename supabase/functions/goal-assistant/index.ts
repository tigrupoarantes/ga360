// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AgentError, RequestBody, SYSTEM_PROMPT, ToolName } from "./config.ts";
import { assertCompanyAccess, getUserModulePermission } from "./access.ts";
import { saveMessage } from "./messages.ts";
import { executeTool } from "./tools.ts";
import { createChatCompletionWithProviderFallback, getAIProviderConfig } from "./provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado", code: "AUTH_INVALID" }), {
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
      return new Response(JSON.stringify({ error: "Token inválido", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json()) as RequestBody;

    if (!body.companyId || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: "companyId e message são obrigatórios", code: "INPUT_INVALID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await assertCompanyAccess(supabaseAdmin, userId, body.companyId);
    const metasPermission = await getUserModulePermission(supabaseAdmin, userId, "metas");

    if (!metasPermission.can_view) {
      return new Response(JSON.stringify({ error: "Usuário sem permissão de acesso ao módulo metas", code: "PERMISSION_DENIED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerConfig = await getAIProviderConfig(supabaseAdmin);

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
      const completionResult = await createChatCompletionWithProviderFallback({
        primary: providerConfig.primary,
        fallback: providerConfig.fallback,
        messages,
      });
      const assistantMessage = completionResult?.completion?.choices?.[0]?.message;

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
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });

    const mappedError =
      error instanceof AgentError
        ? error
        : new AgentError("INTERNAL_ERROR", error?.message || "Erro interno", 500);

    return new Response(JSON.stringify({ error: mappedError.message, code: mappedError.code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: mappedError.status,
    });
  }
});
