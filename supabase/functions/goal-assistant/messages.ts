// @ts-nocheck

import { AgentRole } from "./config.ts";

export async function saveMessage(
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
