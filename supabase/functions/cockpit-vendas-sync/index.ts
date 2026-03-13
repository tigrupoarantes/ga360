// @ts-nocheck
// cockpit-vendas-sync — Sincroniza dados do DAB para a tabela Supabase
// Estratégia: paginação raw (sem $apply) + agregação pedido-level no Deno
// Deploy: supabase functions deploy cockpit-vendas-sync --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COCKPIT_QUERY_NAME = "cockpit_vendas_chokdist";

// ──────────────────────────────────────────────────────────
// Config DAB via dl_queries → dl_connections
// ──────────────────────────────────────────────────────────
async function getQueryConfig(supabaseAdmin: any) {
  const { data: query, error: qErr } = await supabaseAdmin
    .from("dl_queries")
    .select("endpoint_path, connection_id")
    .eq("name", COCKPIT_QUERY_NAME)
    .eq("is_enabled", true)
    .maybeSingle();

  if (qErr || !query) throw new Error(`Query '${COCKPIT_QUERY_NAME}' não encontrada em dl_queries`);

  const { data: conn, error: cErr } = await supabaseAdmin
    .from("dl_connections")
    .select("*")
    .eq("id", query.connection_id)
    .eq("is_enabled", true)
    .maybeSingle();

  if (cErr || !conn) throw new Error("Connection DAB não encontrada");

  const headersJson = conn.headers_json || {};
  const authConfig = conn.auth_config_json || {};
  const apiKey =
    conn.api_key ||
    (authConfig.authHeaderName ? headersJson[authConfig.authHeaderName] : undefined) ||
    headersJson["X-API-Key"] || headersJson["x-api-key"] ||
    authConfig.apiKey || authConfig.api_key;

  const headers: Record<string, string> = { "Accept": "application/json" };
  for (const [k, v] of Object.entries(headersJson)) {
    if (k && v != null) headers[k] = String(v);
  }
  if (apiKey && !headers["X-API-Key"]) headers["X-API-Key"] = apiKey;

  const baseUrl = conn.base_url.replace(/\/+$/, "");
  const endpointPath = query.endpoint_path.startsWith("/") ? query.endpoint_path : `/${query.endpoint_path}`;

  return { endpointUrl: `${baseUrl}${endpointPath}`, headers };
}

// Campos necessários para sync (pedido-level aggregation)
const SYNC_SELECT = [
  "numero_pedido", "cod_cliente", "cod_vendedor", "nome_vendedor",
  "cod_supervisor", "nome_supervisor", "nome_da_equipe",
  "cod_gerente", "nome_gerente", "acao_nao_venda",
  "preco_unitario_prod", "desconto_aplicado_prod", "qtde_vendida",
].join(",");

// ──────────────────────────────────────────────────────────
// Busca um dia do DAB com paginação raw (sem $apply)
// Agrega SKU-level → pedido-level no Deno
// ──────────────────────────────────────────────────────────
async function fetchAndAggregateDayFromDab(
  endpointUrl: string,
  dabHeaders: Record<string, string>,
  date: string,
  budgetMs = 80_000,
): Promise<{ rows: ReturnType<typeof buildPedidoRows>; isPartial: boolean }> {
  const dtInicio = `${date}T00:00:00Z`;
  const dtFim = `${date}T23:59:59Z`;
  const filter = `data ge ${dtInicio} and data le ${dtFim}`;

  const startTime = Date.now();
  // Acumula todos os itens brutos (SKU-level)
  const allItems: any[] = [];
  let nextUrl = `${endpointUrl}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(SYNC_SELECT)}&$first=2000`;
  let pages = 0;
  let isPartial = false;

  while (nextUrl) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= budgetMs) {
      console.log(`[sync] Budget ${budgetMs}ms atingido em ${date} após ${pages} páginas (${allItems.length} itens)`);
      isPartial = true;
      break;
    }

    const remaining = budgetMs - elapsed;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(remaining, 25_000));

    try {
      const res = await fetch(nextUrl, { headers: dabHeaders, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`DAB ${res.status}: ${txt.slice(0, 300)}`);
      }

      const json = await res.json();
      const items = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
      allItems.push(...items);
      pages++;

      const nl = json["@odata.nextLink"] ?? json.nextLink ?? "";
      if (nl) {
        nextUrl = /^https?:\/\//i.test(nl)
          ? nl.replace(/\/api\//i, "/v1/")
          : `${endpointUrl}${nl.startsWith("/") ? nl : "/" + nl}`.replace(/\/api\//i, "/v1/");
      } else {
        nextUrl = "";
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        console.log(`[sync] Timeout na página ${pages + 1} de ${date}. Acumulados: ${allItems.length} itens.`);
        isPartial = true;
        break;
      }
      throw e;
    }
  }

  return { rows: buildPedidoRows(allItems), isPartial };
}

/** Agrega linhas SKU-level em linhas pedido-level (para o Supabase) */
function buildPedidoRows(items: any[]): any[] {
  const pedidoMap = new Map<string, any>();

  for (const item of items) {
    const key = `${item.numero_pedido ?? ""}|${item.cod_cliente ?? ""}|${item.cod_vendedor ?? ""}`;
    if (!pedidoMap.has(key)) {
      pedidoMap.set(key, {
        numero_pedido: item.numero_pedido ?? "",
        cod_cliente: item.cod_cliente ?? "",
        cod_vendedor: item.cod_vendedor ?? "",
        nome_vendedor: item.nome_vendedor ?? null,
        cod_supervisor: item.cod_supervisor ?? null,
        nome_supervisor: item.nome_supervisor ?? null,
        nome_da_equipe: item.nome_da_equipe ?? null,
        cod_gerente: item.cod_gerente ?? null,
        nome_gerente: item.nome_gerente ?? null,
        acao_nao_venda: item.acao_nao_venda || null,
        _soma_preco: 0,
        _soma_desc: 0,
        _soma_qtde: 0,
      });
    }
    const entry = pedidoMap.get(key)!;
    entry._soma_preco += parseFloat(item.preco_unitario_prod ?? 0);
    entry._soma_desc += parseFloat(item.desconto_aplicado_prod ?? 0);
    entry._soma_qtde += parseFloat(item.qtde_vendida ?? 0);
    if (item.acao_nao_venda) entry.acao_nao_venda = item.acao_nao_venda;
  }

  return Array.from(pedidoMap.values()).map((p) => {
    const { _soma_preco, _soma_desc, _soma_qtde, ...rest } = p;
    return {
      ...rest,
      faturamento: Math.round((_soma_preco - _soma_desc) * _soma_qtde * 100) / 100,
      synced_at: new Date().toISOString(),
    };
  });
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + "T12:00:00Z");
  const endD = new Date(end + "T12:00:00Z");
  while (d <= endD) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// ──────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: valida JWT se presente; permite chamadas internas sem header (no-verify-jwt)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !userData?.user) return respond({ error: "Token inválido" }, 401);

      const { data: userRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const roles = (userRoles ?? []).map((r: any) => r.role);
      if (!roles.some((r: string) => ["super_admin", "ceo"].includes(r))) {
        return respond({ error: "Acesso restrito a super_admin/ceo" }, 403);
      }
    }

    const body = await req.json().catch(() => ({}));
    const { company_id, data_inicio, data_fim } = body;
    if (!company_id) return respond({ error: "company_id obrigatório" }, 400);

    const today = new Date().toISOString().slice(0, 10);
    const start = data_inicio || today;
    const end = data_fim || today;
    const dates = dateRange(start, end);

    const dab = await getQueryConfig(supabaseAdmin);

    // Orçamento de tempo por dia: distribui 110s pelo número de dias
    const budgetPerDay = Math.floor(110_000 / dates.length);

    const results: { date: string; rows: number; partial: boolean; status: string }[] = [];

    for (const date of dates) {
      try {
        console.log(`[cockpit-vendas-sync] Sincronizando ${date}...`);

        const { rows: syncRows, isPartial } = await fetchAndAggregateDayFromDab(
          dab.endpointUrl,
          dab.headers,
          date,
          budgetPerDay,
        );

        // Apaga dados antigos do dia e re-insere
        await supabaseAdmin
          .from("cockpit_vendas_sync")
          .delete()
          .eq("company_id", company_id)
          .eq("data_ref", date);

        if (syncRows.length > 0) {
          const rowsWithCompany = syncRows.map((r) => ({ ...r, company_id, data_ref: date }));
          const BATCH = 500;
          for (let i = 0; i < rowsWithCompany.length; i += BATCH) {
            const { error } = await supabaseAdmin
              .from("cockpit_vendas_sync")
              .insert(rowsWithCompany.slice(i, i + BATCH));
            if (error) throw error;
          }
        }

        await supabaseAdmin
          .from("cockpit_vendas_sync_status")
          .upsert(
            { company_id, data_ref: date, row_count: syncRows.length },
            { onConflict: "company_id,data_ref" },
          );

        results.push({ date, rows: syncRows.length, partial: isPartial, status: "ok" });
        console.log(`[cockpit-vendas-sync] ${date}: ${syncRows.length} pedidos${isPartial ? " (parcial)" : ""}`);
      } catch (e: any) {
        console.error(`[cockpit-vendas-sync] Erro em ${date}:`, e.message);
        results.push({ date, rows: 0, partial: false, status: `error: ${e.message}` });
      }
    }

    return respond({ synced: results, synced_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[cockpit-vendas-sync]", err);
    return respond({ error: err.message ?? "Erro interno" }, 500);
  }
});
