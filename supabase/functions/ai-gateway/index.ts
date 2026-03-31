// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { AgentError, RequestBody } from "../goal-assistant/config.ts";
import { runMetasAgent } from "../goal-assistant/core.ts";
import { createChatCompletionWithProviderFallback, getAIProviderConfig } from "../goal-assistant/provider.ts";
import { assertCompanyAccess, getUserModulePermission } from "../goal-assistant/access.ts";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

interface AIGatewayRequest extends Partial<RequestBody> {
  module?: "metas" | "global";
  message: string;
  contextMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

const GLOBAL_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "count_employees",
      description: "Conta funcionários no escopo autorizado com filtros opcionais de ativo, cargo e gênero",
      parameters: {
        type: "object",
        properties: {
          company_id: { type: ["string", "null"] },
          month: { type: ["string", "null"], description: "YYYY-MM" },
          active_only: { type: ["boolean", "null"], description: "Se true, conta apenas funcionários ativos" },
          role: {
            type: ["string", "null"],
            description: "Cargo/função para filtro textual (ex: gerente, supervisor, vendedor)",
          },
          gender: {
            type: ["string", "null"],
            description: "Gênero para filtro textual (ex: feminino, masculino)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_meetings",
      description: "Conta reuniões no escopo autorizado",
      parameters: {
        type: "object",
        properties: {
          company_id: { type: ["string", "null"] },
          date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          month: { type: ["string", "null"], description: "YYYY-MM" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "employee_segment_overview",
      description:
        "Retorna visão segmentada de funcionários no escopo autorizado, com total e distribuição por categoria",
      parameters: {
        type: "object",
        properties: {
          company_id: { type: ["string", "null"] },
          month: { type: ["string", "null"], description: "YYYY-MM" },
          active_only: { type: ["boolean", "null"], description: "Se true, considera apenas funcionários ativos" },
          role: { type: ["string", "null"], description: "Filtro textual de cargo" },
          gender: { type: ["string", "null"], description: "Filtro textual de gênero" },
          group_by: {
            type: ["string", "null"],
            enum: ["position", "department", "gender", "unidade", "none", null],
            description: "Campo de segmentação principal",
          },
          limit: { type: ["number", "null"], description: "Quantidade máxima de itens na segmentação" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_audits",
      description: "Conta auditorias no escopo autorizado",
      parameters: {
        type: "object",
        properties: {
          company_id: { type: ["string", "null"] },
          month: { type: ["string", "null"], description: "YYYY-MM" },
          type: { type: ["string", "null"], enum: ["governanca", "stock", "all", null] },
        },
      },
    },
  },
];

function monthRange(month?: string | null) {
  if (!month) return null;
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return null;

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function dayRange(date?: string | null) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function normalizeGenderAliases(rawGender?: string | null) {
  if (!rawGender) return [] as string[];
  const normalized = rawGender.trim().toLowerCase();
  if (!normalized) return [] as string[];

  if (["f", "fem", "feminino", "female", "mulher", "woman"].includes(normalized)) {
    return ["feminino", "female", "mulher", "f"];
  }

  if (["m", "masc", "masculino", "male", "homem", "man"].includes(normalized)) {
    return ["masculino", "male", "homem", "m"];
  }

  return [normalized];
}

function normalizeRoleAliases(rawRole?: string | null) {
  if (!rawRole) return [] as string[];
  const normalized = rawRole.trim().toLowerCase();
  if (!normalized) return [] as string[];

  if (["gerente", "manager", "gestor"].includes(normalized)) {
    return ["gerente", "manager", "gestor"];
  }

  if (["diretor", "director"].includes(normalized)) {
    return ["diretor", "director"];
  }

  if (["supervisor"].includes(normalized)) {
    return ["supervisor"];
  }

  return [normalized];
}

function applyEmployeeFilters(params: {
  rows: any[];
  activeOnly: boolean;
  roleAliases: string[];
  genderAliases: string[];
}) {
  return params.rows.filter((row: any) => {
    if (params.activeOnly && row.is_active !== true) {
      return false;
    }

    if (params.roleAliases.length) {
      const position = String(row.position || "").toLowerCase();
      const matchesRole = params.roleAliases.some((alias) => position.includes(alias));
      if (!matchesRole) {
        return false;
      }
    }

    if (params.genderAliases.length) {
      const gender = String(row.gender || "").toLowerCase();
      const matchesGender = params.genderAliases.some((alias) => gender.includes(alias));
      if (!matchesGender) {
        return false;
      }
    }

    return true;
  });
}

function topBreakdown(rows: any[], field: "position" | "department" | "gender" | "unidade", limit: number) {
  const bucket = new Map<string, number>();
  for (const row of rows) {
    const key = String(row?.[field] || "Não informado").trim() || "Não informado";
    bucket.set(key, (bucket.get(key) || 0) + 1);
  }

  return Array.from(bucket.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

async function resolveAllowedCompanyIds(supabaseAdmin: any, userId: string, requestedCompanyId?: string | null) {
  const { data: userCompanies, error } = await supabaseAdmin
    .from("user_companies")
    .select("company_id, all_companies")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = userCompanies || [];
  const allCompanies = rows.some((row: any) => row.all_companies === true);
  const explicitCompanyIds = rows.map((row: any) => row.company_id).filter(Boolean);

  if (requestedCompanyId) {
    await assertCompanyAccess(supabaseAdmin, userId, requestedCompanyId);
    return [requestedCompanyId];
  }

  if (allCompanies) {
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("is_active", true);

    if (companiesError) throw companiesError;
    return (companies || []).map((c: any) => c.id);
  }

  return [...new Set(explicitCompanyIds)];
}

function ensureCompanyInScope(requestedCompanyId: string | null | undefined, allowedCompanyIds: string[]) {
  if (!requestedCompanyId) return null;
  if (!allowedCompanyIds.includes(requestedCompanyId)) {
    throw new AgentError("TENANT_ACCESS_DENIED", "Empresa solicitada fora do escopo permitido.", 403);
  }
  return requestedCompanyId;
}

async function executeGlobalTool(params: {
  supabaseAdmin: any;
  userId: string;
  allowedCompanyIds: string[];
  toolName: string;
  rawArgs: string;
}) {
  const { supabaseAdmin, allowedCompanyIds, toolName, rawArgs } = params;
  const args = rawArgs ? JSON.parse(rawArgs) : {};
  const scopedCompany = ensureCompanyInScope(args.company_id, allowedCompanyIds);
  const targetCompanies = scopedCompany ? [scopedCompany] : allowedCompanyIds;

  if (!targetCompanies.length) {
    throw new AgentError("TENANT_ACCESS_DENIED", "Nenhuma empresa disponível no seu escopo de acesso.", 403);
  }

  const meetingsPermission = await getUserModulePermission(supabaseAdmin, params.userId, "meetings");
  const governancaPermission = await getUserModulePermission(supabaseAdmin, params.userId, "governanca");
  const adminPermission = await getUserModulePermission(supabaseAdmin, params.userId, "admin");

  switch (toolName) {
    case "count_employees": {
      if (!adminPermission.can_view) {
        throw new AgentError("PERMISSION_DENIED", "Sem permissão para consultar dados de funcionários.", 403);
      }

      const activeOnly = args.active_only !== false;
      const roleAliases = normalizeRoleAliases(args.role);
      const genderAliases = normalizeGenderAliases(args.gender);

      let query = supabaseAdmin
        .from("external_employees")
        .select("id, position, gender, is_active, created_at")
        .in("company_id", targetCompanies);

      const range = monthRange(args.month);
      if (range) {
        query = query.gte("created_at", range.start).lt("created_at", range.end);
      }

      const { data, error } = await query;
      if (error) throw error;

      const filtered = applyEmployeeFilters({
        rows: data || [],
        activeOnly,
        roleAliases,
        genderAliases,
      });

      return {
        metric: "employees",
        companies: targetCompanies,
        active_only: activeOnly,
        role: args.role || null,
        gender: args.gender || null,
        month: args.month || null,
        total: filtered.length,
      };
    }

    case "employee_segment_overview": {
      if (!adminPermission.can_view) {
        throw new AgentError("PERMISSION_DENIED", "Sem permissão para consultar dados de funcionários.", 403);
      }

      const activeOnly = args.active_only !== false;
      const roleAliases = normalizeRoleAliases(args.role);
      const genderAliases = normalizeGenderAliases(args.gender);
      const groupBy = ["position", "department", "gender", "unidade"].includes(args.group_by)
        ? args.group_by
        : "position";
      const limit = Math.max(1, Math.min(Number(args.limit || 5), 20));

      let query = supabaseAdmin
        .from("external_employees")
        .select("id, position, department, gender, unidade, is_active, created_at")
        .in("company_id", targetCompanies);

      const range = monthRange(args.month);
      if (range) {
        query = query.gte("created_at", range.start).lt("created_at", range.end);
      }

      const { data, error } = await query;
      if (error) throw error;

      const filtered = applyEmployeeFilters({
        rows: data || [],
        activeOnly,
        roleAliases,
        genderAliases,
      });

      const breakdown = topBreakdown(filtered, groupBy, limit);

      return {
        metric: "employees_segment",
        companies: targetCompanies,
        active_only: activeOnly,
        role: args.role || null,
        gender: args.gender || null,
        month: args.month || null,
        group_by: groupBy,
        total: filtered.length,
        breakdown,
      };
    }

    case "count_meetings": {
      if (!meetingsPermission.can_view) {
        throw new AgentError("PERMISSION_DENIED", "Sem permissão para consultar reuniões.", 403);
      }

      let query = supabaseAdmin
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .in("company_id", targetCompanies);

      const daily = dayRange(args.date);
      const monthly = monthRange(args.month);
      if (daily) {
        query = query.gte("scheduled_at", daily.start).lt("scheduled_at", daily.end);
      } else if (monthly) {
        query = query.gte("scheduled_at", monthly.start).lt("scheduled_at", monthly.end);
      }

      const { count, error } = await query;
      if (error) throw error;

      return {
        metric: "meetings",
        companies: targetCompanies,
        date: args.date || null,
        month: args.month || null,
        total: count || 0,
      };
    }

    case "count_audits": {
      if (!governancaPermission.can_view && !adminPermission.can_view) {
        throw new AgentError("PERMISSION_DENIED", "Sem permissão para consultar auditorias.", 403);
      }

      const auditType = args.type || "all";
      const monthly = monthRange(args.month);

      let total = 0;

      if (auditType === "all" || auditType === "governanca") {
        let govQuery = supabaseAdmin
          .from("ec_card_records")
          .select("id", { count: "exact", head: true })
          .in("company_id", targetCompanies);

        if (monthly) {
          govQuery = govQuery.gte("created_at", monthly.start).lt("created_at", monthly.end);
        }

        const { count, error } = await govQuery;
        if (error) throw error;
        total += count || 0;
      }

      if (auditType === "all" || auditType === "stock") {
        let stockQuery = supabaseAdmin
          .from("stock_audits")
          .select("id", { count: "exact", head: true })
          .in("company_id", targetCompanies);

        if (monthly) {
          stockQuery = stockQuery.gte("created_at", monthly.start).lt("created_at", monthly.end);
        }

        const { count, error } = await stockQuery;
        if (error) throw error;
        total += count || 0;
      }

      return {
        metric: "audits",
        type: auditType,
        companies: targetCompanies,
        month: args.month || null,
        total,
      };
    }

    default:
      throw new AgentError("INPUT_INVALID", `Tool global não suportada: ${toolName}`, 400);
  }
}

async function runGlobalAgent(supabaseAdmin: any, userId: string, body: AIGatewayRequest) {
  const adminPermission = await getUserModulePermission(supabaseAdmin, userId, "admin");
  if (/sal[aá]rio|remunera[cç][aã]o|holerite|payroll/i.test(body.message || "") && !adminPermission.can_view) {
    return {
      status: 403,
      payload: {
        error: "Você não possui permissão para solicitar informações salariais ou sensíveis.",
        code: "PERMISSION_DENIED",
      },
    };
  }

  const allowedCompanyIds = await resolveAllowedCompanyIds(supabaseAdmin, userId, body.companyId || null);
  const providerConfig = await getAIProviderConfig(supabaseAdmin);

  const messages: any[] = [
    {
      role: "system",
      content:
        "Você é o Copiloto Global do GA360. Responda em português-BR, de forma direta e objetiva. " +
        "Use apenas dados retornados por tools. Nunca exponha dados sensíveis sem permissão. " +
        "Quando company_id não for informado, considere todas as empresas permitidas ao usuário. " +
        "Para perguntas de funcionários, assuma active_only=true por padrão e só peça mês se o usuário realmente pedir período. " +
        "Não peça empresa/período extra quando a pergunta já permite resposta agregada no escopo autorizado. " +
        "Não misture métricas: se o usuário perguntar sobre funcionários, não traga reuniões/auditorias. " +
        "Use employee_segment_overview quando a pergunta envolver recortes (ex.: gerentes mulheres, por departamento, por unidade).",
    },
  ];

  const contextMessages = (body.contextMessages || [])
    .filter((item) => item?.content && ["user", "assistant"].includes(item.role))
    .slice(-4)
    .map((item) => ({
      role: item.role,
      content: String(item.content).trim(),
    }))
    .filter((item) => item.content.length > 0);

  messages.push(...contextMessages);
  messages.push({ role: "user", content: body.message.trim() });

  for (let iteration = 0; iteration < 5; iteration++) {
    const completionResult = await createChatCompletionWithProviderFallback({
      primary: providerConfig.primary,
      fallback: providerConfig.fallback,
      messages,
      tools: GLOBAL_TOOL_DEFINITIONS,
    });

    const assistantMessage = completionResult?.completion?.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new AgentError("INTERNAL_ERROR", "Resposta inválida do assistente global", 500);
    }

    const toolCalls = assistantMessage.tool_calls || [];

    if (!toolCalls.length) {
      return {
        status: 200,
        payload: { success: true, reply: assistantMessage.content || "Sem resposta." },
      };
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content || "",
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      let toolResult: unknown;
      try {
        toolResult = await executeGlobalTool({
          supabaseAdmin,
          userId,
          allowedCompanyIds,
          toolName: call.function.name,
          rawArgs: call.function.arguments,
        });
      } catch (toolError: any) {
        toolResult = { error: toolError?.message || "Erro ao executar tool global" };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  return {
    status: 200,
    payload: {
      success: true,
      reply: "Concluí o processamento, mas não consegui gerar uma resposta final. Reformule a pergunta.",
    },
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json()) as AIGatewayRequest;

    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: "message é obrigatório", code: "INPUT_INVALID" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const targetModule = body.module || "global";

    if (targetModule === "metas") {
      if (!body.companyId) {
        return new Response(JSON.stringify({ error: "companyId é obrigatório para módulo metas", code: "INPUT_INVALID" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const result = await runMetasAgent(supabaseAdmin, userId, body as RequestBody);
      return new Response(JSON.stringify(result.payload), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: result.status,
      });
    }

    const result = await runGlobalAgent(supabaseAdmin, userId, body);
    return new Response(JSON.stringify(result.payload), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: result.status,
    });
  } catch (error: any) {
    console.error("Erro em ai-gateway:", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });

    const mappedError =
      error instanceof AgentError
        ? error
        : new AgentError("INTERNAL_ERROR", error?.message || "Erro interno", 500);

    return new Response(JSON.stringify({ error: mappedError.message, code: mappedError.code }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: mappedError.status,
    });
  }
});
