// @ts-nocheck

import { RequestBody, SYSTEM_PROMPT, ToolName } from "./config.ts";
import { assertCompanyAccess, getUserModulePermission } from "./access.ts";
import { saveMessage } from "./messages.ts";
import { executeTool } from "./tools.ts";
import { createChatCompletionWithProviderFallback, getAIProviderConfig } from "./provider.ts";

export async function runMetasAgent(supabaseAdmin: any, userId: string, body: RequestBody) {
  await assertCompanyAccess(supabaseAdmin, userId, body.companyId);
  const metasPermission = await getUserModulePermission(supabaseAdmin, userId, "metas");

  if (!metasPermission.can_view) {
    return {
      status: 403,
      payload: { error: "Usuário sem permissão de acesso ao módulo metas", code: "PERMISSION_DENIED" },
    };
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

  return {
    status: 200,
    payload: { success: true, reply: finalAssistantText },
  };
}
