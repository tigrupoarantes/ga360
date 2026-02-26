// @ts-nocheck

import { AgentError, ModulePermission, ToolName } from "./config.ts";

export async function assertCompanyAccess(supabaseAdmin: any, userId: string, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_companies")
    .select("company_id, all_companies")
    .eq("user_id", userId);

  if (error) throw error;

  const allCompanies = (data || []).some((row: any) => row.all_companies === true);
  const hasSpecific = (data || []).some((row: any) => row.company_id === companyId);

  if (!allCompanies && !hasSpecific) {
    throw new AgentError("TENANT_ACCESS_DENIED", "Usuário sem acesso à empresa informada.", 403);
  }
}

export async function ensureGoalInCompany(supabaseAdmin: any, goalId: string, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Meta não encontrada na empresa selecionada.");
}

export async function getUserModulePermission(
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

export function assertToolPermission(toolName: ToolName, permission: ModulePermission) {
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
