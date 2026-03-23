// mcp-server/index.ts — GA360 MCP Server (Model Context Protocol)
// Implementa MCP HTTP+SSE transport para integração com Claude Desktop / Claude API
// Spec: https://spec.modelcontextprotocol.io/
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateApiKey } from "../public-api/_auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function supabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Shared company_id param (required for global keys, ignored for scoped keys) ──
const COMPANY_ID_PARAM = {
  company_id: {
    type: "string",
    description: "UUID da empresa. Obrigatório para chaves de API globais. Ignorado para chaves de empresa fixa. Use get_companies para listar as opções.",
  },
};

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_goals",
    description: "Lista metas/OKRs da empresa. Pode filtrar por status, pilar, cadência ou área.",
    inputSchema: {
      type: "object",
      properties: {
        ...COMPANY_ID_PARAM,
        status: { type: "string", enum: ["on_track", "at_risk", "behind", "completed"], description: "Filtro por status" },
        pillar: { type: "string", enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG"], description: "Pilar estratégico" },
        cadence: { type: "string", enum: ["mensal", "trimestral", "anual"] },
        area_id: { type: "string", description: "UUID da área" },
        limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "get_goal",
    description: "Retorna detalhes completos de uma meta incluindo histórico de atualizações e atividades.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        ...COMPANY_ID_PARAM,
        id: { type: "string", description: "UUID da meta" },
      },
    },
  },
  {
    name: "create_goal",
    description: "Cria uma nova meta estratégica na empresa.",
    inputSchema: {
      type: "object",
      required: ["title", "pillar", "unit", "target_value", "cadence"],
      properties: {
        ...COMPANY_ID_PARAM,
        title: { type: "string", description: "Título da meta" },
        pillar: { type: "string", enum: ["FAT", "RT", "MS", "SC", "DN", "CO", "ESG"] },
        unit: { type: "string", description: "Unidade de medida (%, R$, unidades, etc.)" },
        target_value: { type: "number", description: "Valor alvo" },
        cadence: { type: "string", enum: ["mensal", "trimestral", "anual"] },
        area_id: { type: "string", description: "UUID da área (opcional)" },
        responsible_id: { type: "string", description: "UUID do responsável (opcional)" },
      },
    },
  },
  {
    name: "update_goal",
    description: "Atualiza campos de uma meta existente: título, valor alvo, status ou responsável.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        ...COMPANY_ID_PARAM,
        id: { type: "string" },
        title: { type: "string" },
        target_value: { type: "number" },
        status: { type: "string", enum: ["on_track", "at_risk", "behind", "completed"] },
        responsible_id: { type: "string" },
      },
    },
  },
  {
    name: "add_goal_progress",
    description: "Registra um novo valor de progresso para uma meta (insere goal_update).",
    inputSchema: {
      type: "object",
      required: ["id", "value"],
      properties: {
        ...COMPANY_ID_PARAM,
        id: { type: "string", description: "UUID da meta" },
        value: { type: "number", description: "Valor atual atingido" },
        notes: { type: "string", description: "Observações sobre o progresso (opcional)" },
      },
    },
  },
  {
    name: "get_meetings",
    description: "Lista reuniões da empresa com filtros por status, área e período.",
    inputSchema: {
      type: "object",
      properties: {
        ...COMPANY_ID_PARAM,
        status: { type: "string", description: "Ex: agendada, em_andamento, concluida, cancelada" },
        area_id: { type: "string" },
        scheduled_after: { type: "string", description: "ISO 8601 — retorna reuniões após esta data" },
        scheduled_before: { type: "string", description: "ISO 8601 — retorna reuniões antes desta data" },
        limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "get_meeting",
    description: "Retorna detalhes de uma reunião: participantes, ATA gerada pela IA e tarefas.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        ...COMPANY_ID_PARAM,
        id: { type: "string", description: "UUID da reunião" },
      },
    },
  },
  {
    name: "create_meeting",
    description: "Agenda uma nova reunião na plataforma GA360.",
    inputSchema: {
      type: "object",
      required: ["title", "type", "scheduled_at", "duration_minutes"],
      properties: {
        ...COMPANY_ID_PARAM,
        title: { type: "string" },
        type: { type: "string", enum: ["Estratégica", "Tática", "Operacional", "Trade"] },
        scheduled_at: { type: "string", description: "ISO 8601 — data e hora da reunião" },
        duration_minutes: { type: "integer", default: 60 },
        area_id: { type: "string" },
        participant_ids: { type: "array", items: { type: "string" }, description: "UUIDs dos participantes" },
      },
    },
  },
  {
    name: "update_meeting",
    description: "Atualiza dados de uma reunião existente: título, data, status.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        ...COMPANY_ID_PARAM,
        id: { type: "string" },
        title: { type: "string" },
        scheduled_at: { type: "string" },
        duration_minutes: { type: "integer" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "get_kpis",
    description: "Retorna KPIs comerciais da empresa: vendas MTD/WTD/DTD, positivação, cobertura e ticket médio.",
    inputSchema: {
      type: "object",
      required: ["start_date", "end_date"],
      properties: {
        ...COMPANY_ID_PARAM,
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        channel_code: { type: "string" },
        bu_id: { type: "string" },
      },
    },
  },
  {
    name: "get_companies",
    description:
      "Lista as empresas acessíveis pela chave de API. " +
      "Para chaves globais, retorna TODAS as empresas ativas do grupo. " +
      "Sempre chame esta tool primeiro ao usar uma chave global para obter os UUIDs das empresas.",
    inputSchema: { type: "object", properties: {} },
  },

  // ── DAB / Datalake tools ───────────────────────────────────────────────────

  {
    name: "query_cockpit_kpis",
    description:
      "Retorna KPIs de vendas do Cockpit GA a partir do Datalake (SQL Server): faturamento, pedidos, ticket médio, cobertura, ranking de vendedores e não-vendas. " +
      "Use para responder perguntas sobre vendas, performance de vendedores ou clientes sem pedido. " +
      "Exemplos: 'como estão as vendas?', 'top vendedores da semana', 'clientes que não compraram hoje'.",
    inputSchema: {
      type: "object",
      required: ["data_inicio", "data_fim"],
      properties: {
        ...COMPANY_ID_PARAM,
        data_inicio: { type: "string", description: "Data de início no formato YYYY-MM-DD" },
        data_fim: { type: "string", description: "Data de fim no formato YYYY-MM-DD" },
        endpoint: {
          type: "string",
          enum: ["kpis", "pedidos", "nao-vendas", "ranking"],
          description: "Tipo de dado: kpis=agregado (padrão), pedidos=lista de pedidos, nao-vendas=clientes sem pedido, ranking=top vendedores",
        },
        cod_vendedor_filtro: {
          type: "string",
          description: "Código do vendedor para filtrar (opcional — omitir para visão geral)",
        },
      },
    },
  },
  {
    name: "get_sync_status",
    description:
      "Retorna o status de sincronização dos módulos DAB: últimas syncs executadas, erros recentes e cobertura diária do cockpit nos últimos 7 dias. " +
      "Use quando o usuário perguntar se os dados estão atualizados ou quando foi a última sincronização.",
    inputSchema: { type: "object", properties: { ...COMPANY_ID_PARAM } },
  },
  {
    name: "trigger_cockpit_sync",
    description:
      "Dispara sincronização manual do Cockpit de Vendas para um intervalo de datas. " +
      "Use quando o usuário pedir para atualizar os dados de vendas ou quando get_sync_status indicar que faltam dias sincronizados.",
    inputSchema: {
      type: "object",
      required: ["data_inicio", "data_fim"],
      properties: {
        ...COMPANY_ID_PARAM,
        data_inicio: { type: "string", description: "Data de início no formato YYYY-MM-DD" },
        data_fim: { type: "string", description: "Data de fim no formato YYYY-MM-DD" },
      },
    },
  },
  {
    name: "query_verbas",
    description:
      "Consulta verbas indenizatórias (payroll) sincronizadas do Datalake: rubricas mensais por colaborador (férias, rescisão, 13º salário, PLR). " +
      "Use para responder perguntas sobre folha de pagamento, verbas de colaboradores ou competência específica.",
    inputSchema: {
      type: "object",
      properties: {
        ...COMPANY_ID_PARAM,
        ano: { type: "integer", description: "Ano de competência (ex: 2025). Omitir para todos os anos disponíveis." },
        cpf: { type: "string", description: "CPF do colaborador — apenas dígitos, sem pontuação (opcional)" },
        tipo_verba: {
          type: "string",
          enum: ["ferias", "rescisao", "13_salario", "plr"],
          description: "Tipo de verba para filtrar (opcional)",
        },
      },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { companyId: string | null; isGlobal: boolean },
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const db = supabase();

  // Resolve effective company: scoped key uses ctx.companyId; global key uses args.company_id
  const companyId: string | null = ctx.isGlobal
    ? (args.company_id as string | undefined) ?? null
    : ctx.companyId;

  // All tools except get_companies require a resolved company
  if (!companyId && name !== "get_companies") {
    return {
      content: [{
        type: "text",
        text: 'Esta chave de API é global. Passe "company_id" como argumento ou chame get_companies primeiro para listar as empresas disponíveis.',
      }],
      isError: true,
    };
  }

  try {
    let result: unknown;

    switch (name) {
      case "get_goals": {
        let q = db.from("goals")
          .select("id, title, pillar, unit, target_value, current_value, status, cadence, area_id, responsible_id, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit((args.limit as number) ?? 20);
        if (args.status) q = q.eq("status", args.status as string);
        if (args.pillar) q = q.eq("pillar", args.pillar as string);
        if (args.cadence) q = q.eq("cadence", args.cadence as string);
        if (args.area_id) q = q.eq("area_id", args.area_id as string);
        const { data, error } = await q;
        if (error) throw error;
        result = data;
        break;
      }

      case "get_goal": {
        const { data, error } = await db.from("goals")
          .select("*, goal_updates(id, value, notes, created_at), goal_activities(id, title, status, weight, due_date)")
          .eq("id", args.id as string)
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) throw error;
        result = data;
        break;
      }

      case "create_goal": {
        const { data, error } = await db.from("goals").insert({
          title: args.title, pillar: args.pillar, unit: args.unit,
          target_value: args.target_value, cadence: args.cadence,
          area_id: args.area_id ?? null, responsible_id: args.responsible_id ?? null,
          company_id: companyId, status: "on_track", current_value: 0,
        }).select().maybeSingle();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_goal": {
        const patch: Record<string, unknown> = {};
        for (const key of ["title", "target_value", "status", "responsible_id"]) {
          if (key in args) patch[key] = args[key];
        }
        const { data, error } = await db.from("goals").update(patch)
          .eq("id", args.id as string).eq("company_id", companyId).select().maybeSingle();
        if (error) throw error;
        result = data;
        break;
      }

      case "add_goal_progress": {
        const { data: goalData } = await db.from("goals").select("id").eq("id", args.id as string).eq("company_id", companyId).maybeSingle();
        if (!goalData) throw new Error("Goal not found");
        const { data, error } = await db.from("goal_updates").insert({
          goal_id: args.id, value: args.value, notes: args.notes ?? null,
        }).select().maybeSingle();
        if (error) throw error;
        await db.from("goals").update({ current_value: args.value }).eq("id", args.id as string);
        result = data;
        break;
      }

      case "get_meetings": {
        let q = db.from("meetings")
          .select("id, title, type, status, scheduled_at, duration_minutes, area_id, company_id, created_at")
          .eq("company_id", companyId)
          .order("scheduled_at", { ascending: false })
          .limit((args.limit as number) ?? 20);
        if (args.status) q = q.eq("status", args.status as string);
        if (args.area_id) q = q.eq("area_id", args.area_id as string);
        if (args.scheduled_after) q = q.gte("scheduled_at", args.scheduled_after as string);
        if (args.scheduled_before) q = q.lte("scheduled_at", args.scheduled_before as string);
        const { data, error } = await q;
        if (error) throw error;
        result = data;
        break;
      }

      case "get_meeting": {
        const { data, error } = await db.from("meetings")
          .select("*, meeting_participants(id, user_id, attended, confirmation_status), meeting_atas(id, summary, decisions, action_items), meeting_tasks(id, title, status, assignee_id, due_date)")
          .eq("id", args.id as string).eq("company_id", companyId).maybeSingle();
        if (error) throw error;
        result = data;
        break;
      }

      case "create_meeting": {
        const { data: mtg, error } = await db.from("meetings").insert({
          title: args.title, type: args.type, scheduled_at: args.scheduled_at,
          duration_minutes: args.duration_minutes, area_id: args.area_id ?? null,
          company_id: companyId, status: "agendada",
        }).select().maybeSingle();
        if (error) throw error;
        if (Array.isArray(args.participant_ids) && args.participant_ids.length > 0) {
          await db.from("meeting_participants").insert(
            (args.participant_ids as string[]).map((uid) => ({ meeting_id: mtg.id, user_id: uid })),
          );
        }
        result = mtg;
        break;
      }

      case "update_meeting": {
        const patch: Record<string, unknown> = {};
        for (const key of ["title", "scheduled_at", "duration_minutes", "status"]) {
          if (key in args) patch[key] = args[key];
        }
        const { data, error } = await db.from("meetings").update(patch)
          .eq("id", args.id as string).eq("company_id", companyId).select().maybeSingle();
        if (error) throw error;
        result = data;
        break;
      }

      case "get_kpis": {
        const kpiUrl = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/kpi-summary`);
        kpiUrl.searchParams.set("company_id", companyId);
        kpiUrl.searchParams.set("start_date", args.start_date as string);
        kpiUrl.searchParams.set("end_date", args.end_date as string);
        if (args.channel_code) kpiUrl.searchParams.set("channel_code", args.channel_code as string);
        if (args.bu_id) kpiUrl.searchParams.set("bu_id", args.bu_id as string);
        const res = await fetch(kpiUrl.toString(), {
          headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        });
        result = await res.json();
        break;
      }

      case "get_companies": {
        let q = db.from("companies").select("id, name, cnpj, is_active");
        if (!ctx.isGlobal) {
          q = q.eq("id", companyId!);
        } else {
          q = q.eq("is_active", true).order("name");
        }
        const { data, error } = await q;
        if (error) throw error;
        result = data;
        break;
      }

      // ── DAB / Datalake tools ────────────────────────────────────────────────

      case "query_cockpit_kpis": {
        const queryUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cockpit-vendas-query`;
        const res = await fetch(queryUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpoint: (args.endpoint as string) ?? "kpis",
            company_id: companyId,
            data_inicio: args.data_inicio as string,
            data_fim: args.data_fim as string,
            ...(args.cod_vendedor_filtro ? { cod_vendedor_filtro: args.cod_vendedor_filtro } : {}),
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`cockpit-vendas-query retornou ${res.status}: ${errText}`);
        }
        result = await res.json();
        break;
      }

      case "get_sync_status": {
        const [logsRes, statusRes] = await Promise.all([
          db.from("sync_logs")
            .select("sync_type, status, records_received, created_at, errors")
            .order("created_at", { ascending: false })
            .limit(10),
          db.from("cockpit_vendas_sync_status")
            .select("data_ref, row_count")
            .eq("company_id", companyId)
            .order("data_ref", { ascending: false })
            .limit(7),
        ]);
        result = {
          recent_syncs: logsRes.data ?? [],
          cockpit_last_7_days: statusRes.data ?? [],
          summary: `${statusRes.data?.length ?? 0} dias com dados sincronizados nos últimos 7`,
        };
        break;
      }

      case "trigger_cockpit_sync": {
        const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cockpit-vendas-sync`;
        const res = await fetch(syncUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: companyId,
            data_inicio: args.data_inicio as string,
            data_fim: args.data_fim as string,
          }),
        });
        result = {
          triggered: true,
          http_status: res.status,
          message: res.ok
            ? "Sync disparado. Os dados estarão disponíveis em instantes."
            : `Sync retornou status ${res.status} — verificar logs.`,
        };
        break;
      }

      case "query_verbas": {
        let q = db.from("payroll_verba_pivot")
          .select("cpf, tipo_verba, ano, jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez, employee_dept, employee_position")
          .eq("company_id", companyId)
          .order("ano", { ascending: false })
          .limit(100);
        if (args.ano) q = q.eq("ano", args.ano as number);
        if (args.cpf) q = q.eq("cpf", args.cpf as string);
        if (args.tipo_verba) q = q.eq("tipo_verba", args.tipo_verba as string);
        const { data, error } = await q;
        if (error) throw error;
        result = data;
        break;
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e: any) {
    return {
      content: [{ type: "text", text: `Error: ${e.message}` }],
      isError: true,
    };
  }
}

// ── MCP JSON-RPC 2.0 handler ───────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ctx = await validateApiKey(req);
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { id, method, params } = body;

  let result: unknown;

  switch (method) {
    case "initialize":
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "ga360-mcp", version: "1.0.0" },
        instructions: ctx.isGlobal
          ? "Você é um assistente do GA360 com acesso GLOBAL a todas as empresas do grupo. " +
            "Sempre chame get_companies primeiro para obter a lista de empresas e seus UUIDs. " +
            "Passe company_id como argumento em todas as tools que operam sobre dados de empresa. " +
            "Você tem acesso a metas (OKRs), reuniões, KPIs comerciais do Datalake (cockpit de vendas), " +
            "verbas indenizatórias, status de sincronização DAB e dados de todas as empresas. " +
            "Para dados de vendas e performance comercial, use query_cockpit_kpis. " +
            "Para verificar se os dados estão atualizados, use get_sync_status."
          : `Você é um assistente do GA360 — plataforma de gestão estratégica integrada da empresa "${ctx.companyName}". ` +
            "Você tem acesso às metas (OKRs), reuniões, KPIs comerciais do Datalake (cockpit de vendas), " +
            "verbas indenizatórias, status de sincronização DAB e dados gerais da empresa. " +
            "Use as tools disponíveis para consultar e atualizar informações conforme solicitado. " +
            "Para dados de vendas e performance comercial, use query_cockpit_kpis. " +
            "Para verificar se os dados estão atualizados, use get_sync_status.",
      };
      break;

    case "notifications/initialized":
      // Notificação do cliente — não requer resposta
      return new Response(null, { status: 204, headers: corsHeaders });

    case "tools/list":
      result = { tools: TOOLS };
      break;

    case "tools/call": {
      const toolName = (params as any)?.name as string;
      const toolArgs = ((params as any)?.arguments ?? {}) as Record<string, unknown>;
      result = await executeTool(toolName, toolArgs, { companyId: ctx.companyId, isGlobal: ctx.isGlobal });
      break;
    }

    default:
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
  }

  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, result }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
