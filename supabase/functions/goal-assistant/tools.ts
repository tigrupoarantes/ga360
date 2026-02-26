// @ts-nocheck

import { ModulePermission, ToolName } from "./config.ts";
import { assertToolPermission, ensureGoalInCompany } from "./access.ts";

export async function executeTool(
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
