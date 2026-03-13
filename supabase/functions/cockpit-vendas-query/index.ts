// @ts-nocheck
// cockpit-vendas-query — Edge Function para o Cockpit de Vendas (Chok Distribuidora)
// Estratégia: KPIs e Ranking lidos de cockpit_vendas_sync (Supabase, <100ms)
//             Pedidos e Não-Vendas ainda lidos do DAB (escopo pequeno por vendedor)
// Se não houver dados sincronizados, dispara cockpit-vendas-sync em background

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────
type Endpoint = "kpis" | "pedidos" | "nao-vendas" | "ranking";
type NivelAcesso = "vendedor" | "supervisor" | "gerente" | "diretoria";

interface QueryRequest {
  endpoint: Endpoint;
  company_id: string;
  data_inicio: string;   // YYYY-MM-DD
  data_fim: string;      // YYYY-MM-DD
  page?: number;
  page_size?: number;
  cod_vendedor_filtro?: string;
}

interface DabConfig {
  endpointUrl: string;
  headers: Record<string, string>;
}

interface KpiResult {
  faturamento_total: number;
  total_pedidos: number;
  ticket_medio: number;
  clientes_visitados: number;
  cobertura_pct: number | null;
  nao_vendas: number;
}

interface CachePayload {
  kpis?: KpiResult;
  items?: any[];
  pagination?: { page: number; page_size: number; total_items: number; has_more: boolean };
  cached_at: string;
  fonte?: "sync" | "dab";  // origem dos dados para diagnóstico
}

const COCKPIT_QUERY_NAME = "cockpit_vendas_chokdist";

// ──────────────────────────────────────────────────────────
// Config DAB via dl_queries → dl_connections
// ──────────────────────────────────────────────────────────
async function getQueryConfig(supabaseAdmin: any): Promise<DabConfig> {
  const { data: query, error: qErr } = await supabaseAdmin
    .from("dl_queries")
    .select("endpoint_path, connection_id")
    .eq("name", COCKPIT_QUERY_NAME)
    .eq("is_enabled", true)
    .maybeSingle();

  if (qErr || !query) {
    throw new Error(`Query '${COCKPIT_QUERY_NAME}' não encontrada em dl_queries. Configure em /admin/datalake → Queries.`);
  }

  const { data: conn, error: cErr } = await supabaseAdmin
    .from("dl_connections")
    .select("*")
    .eq("id", query.connection_id)
    .eq("is_enabled", true)
    .maybeSingle();

  if (cErr || !conn) throw new Error("Connection DAB não encontrada ou desabilitada");

  const headersJson = conn.headers_json || {};
  const authConfig = conn.auth_config_json || {};
  const apiKey =
    conn.api_key ||
    (authConfig.authHeaderName ? headersJson[authConfig.authHeaderName] : undefined) ||
    headersJson["X-API-Key"] ||
    headersJson["x-api-key"] ||
    authConfig.apiKey ||
    authConfig.api_key;

  const headers: Record<string, string> = { "Accept": "application/json" };
  for (const [k, v] of Object.entries(headersJson)) {
    if (k && v != null) headers[k] = String(v);
  }
  if (apiKey && !headers["X-API-Key"]) headers["X-API-Key"] = apiKey;

  const baseUrl = conn.base_url.replace(/\/+$/, "");
  const endpointPath = query.endpoint_path.startsWith("/")
    ? query.endpoint_path
    : `/${query.endpoint_path}`;

  return { endpointUrl: `${baseUrl}${endpointPath}`, headers };
}

// ──────────────────────────────────────────────────────────
// Leitura de KPIs / Ranking do cockpit_vendas_sync (Supabase)
// ──────────────────────────────────────────────────────────

/** Verifica se todos os dias do intervalo estão sincronizados */
async function isSyncCovered(
  supabaseAdmin: any,
  company_id: string,
  data_inicio: string,
  data_fim: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("cockpit_vendas_sync_status")
    .select("data_ref")
    .eq("company_id", company_id)
    .gte("data_ref", data_inicio)
    .lte("data_ref", data_fim);

  if (error || !data) return false;

  // Conta quantos dias únicos há no intervalo
  const start = new Date(data_inicio + "T12:00:00Z");
  const end = new Date(data_fim + "T12:00:00Z");
  let totalDays = 0;
  const d = new Date(start);
  while (d <= end) { totalDays++; d.setUTCDate(d.getUTCDate() + 1); }

  return data.length >= totalDays;
}

/** Monta query Supabase com escopo de acesso do usuário */
function applyScopeFilter(
  query: any,
  nivelAcesso: NivelAcesso,
  codVendedor: string,
  codVendedorFiltro?: string,
) {
  if (codVendedorFiltro) {
    return query.eq("cod_vendedor", codVendedorFiltro);
  }
  if (nivelAcesso === "vendedor") {
    return query.eq("cod_vendedor", codVendedor);
  }
  if (nivelAcesso === "supervisor") {
    return query.eq("cod_supervisor", codVendedor);
  }
  if (nivelAcesso === "gerente") {
    return query.eq("cod_gerente", codVendedor);
  }
  // diretoria: sem filtro de pessoa
  return query;
}

/** Agrega rows do cockpit_vendas_sync em KpiResult */
function aggregateSyncRows(rows: any[]): KpiResult {
  const pedidosUnicos = new Set<string>();
  const clientesUnicos = new Set<string>();
  let faturamento = 0;
  let naoVendas = 0;

  for (const row of rows) {
    if (row.numero_pedido) pedidosUnicos.add(row.numero_pedido);
    if (row.cod_cliente) clientesUnicos.add(row.cod_cliente);
    faturamento += parseFloat(row.faturamento ?? 0);
    if (row.acao_nao_venda) naoVendas++;
  }

  const totalPedidos = pedidosUnicos.size;
  return {
    faturamento_total: Math.round(faturamento * 100) / 100,
    total_pedidos: totalPedidos,
    ticket_medio: Math.round((totalPedidos > 0 ? faturamento / totalPedidos : 0) * 100) / 100,
    clientes_visitados: clientesUnicos.size,
    cobertura_pct: null,
    nao_vendas: naoVendas,
  };
}

/** Gera ranking de vendedores a partir dos rows sincronizados */
function buildRankingFromSync(rows: any[]): any[] {
  const byVendedor = new Map<string, {
    nome: string;
    faturamento: number;
    pedidos: Set<string>;
    naoVendas: number;
  }>();

  for (const row of rows) {
    const cod = row.cod_vendedor ?? "";
    const nome = row.nome_vendedor ?? cod;
    if (!byVendedor.has(cod)) {
      byVendedor.set(cod, { nome, faturamento: 0, pedidos: new Set(), naoVendas: 0 });
    }
    const entry = byVendedor.get(cod)!;
    if (row.numero_pedido) entry.pedidos.add(row.numero_pedido);
    entry.faturamento += parseFloat(row.faturamento ?? 0);
    if (row.acao_nao_venda) entry.naoVendas++;
  }

  return Array.from(byVendedor.entries())
    .map(([cod, v]) => ({
      cod_vendedor: cod,
      nome_vendedor: v.nome,
      faturamento: Math.round(v.faturamento * 100) / 100,
      total_pedidos: v.pedidos.size,
      nao_vendas: v.naoVendas,
    }))
    .sort((a, b) => b.faturamento - a.faturamento);
}

/** Lê KPIs ou Ranking do cockpit_vendas_sync. Retorna null se sem dados. */
async function queryFromSync(
  supabaseAdmin: any,
  endpoint: "kpis" | "ranking",
  company_id: string,
  data_inicio: string,
  data_fim: string,
  nivelAcesso: NivelAcesso,
  codVendedor: string,
  codVendedorFiltro?: string,
): Promise<CachePayload | null> {
  let q = supabaseAdmin
    .from("cockpit_vendas_sync")
    .select("numero_pedido,cod_cliente,cod_vendedor,nome_vendedor,faturamento,acao_nao_venda")
    .eq("company_id", company_id)
    .gte("data_ref", data_inicio)
    .lte("data_ref", data_fim);

  q = applyScopeFilter(q, nivelAcesso, codVendedor, codVendedorFiltro);

  const { data, error } = await q;
  if (error) throw error;
  if (!data || data.length === 0) return null;

  if (endpoint === "kpis") {
    return { kpis: aggregateSyncRows(data), cached_at: new Date().toISOString(), fonte: "sync" };
  } else {
    return { items: buildRankingFromSync(data), cached_at: new Date().toISOString(), fonte: "sync" };
  }
}

// ──────────────────────────────────────────────────────────
// Dispara sync em background (fire-and-forget)
// ──────────────────────────────────────────────────────────
function triggerSyncBackground(company_id: string, data_inicio: string, data_fim: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  fetch(`${supabaseUrl}/functions/v1/cockpit-vendas-sync`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ company_id, data_inicio, data_fim }),
  }).catch((e) => console.warn("[cockpit-vendas-query] trigger sync falhou:", e.message));
}

// ──────────────────────────────────────────────────────────
// DAB helpers (mantidos para pedidos / nao-vendas / fallback)
// ──────────────────────────────────────────────────────────
function normalizeNextLink(nextLink: string, baseUrl: string): string {
  if (!nextLink) return "";
  if (/^https?:\/\//i.test(nextLink)) return nextLink.replace(/\/api\//i, "/v1/");
  const path = nextLink.startsWith("/") ? nextLink : `/${nextLink}`;
  return `${baseUrl}${path}`.replace(/\/api\//i, "/v1/");
}

function buildFilter(
  nivelAcesso: NivelAcesso,
  codVendedor: string,
  dataInicio: string,
  dataFim: string,
  codVendedorFiltro?: string,
): string {
  const parts: string[] = [];
  const dtInicio = `${dataInicio}T00:00:00Z`;
  const dtFim = `${dataFim}T23:59:59Z`;
  parts.push(`(data ge ${dtInicio} and data le ${dtFim})`);

  if (nivelAcesso === "vendedor") {
    parts.push(`cod_vendedor eq '${codVendedorFiltro || codVendedor}'`);
  } else if (nivelAcesso === "supervisor") {
    parts.push(`cod_supervisor eq '${codVendedor}'`);
  } else if (nivelAcesso === "gerente") {
    parts.push(`cod_gerente eq '${codVendedor}'`);
  }

  if (codVendedorFiltro && nivelAcesso !== "vendedor") {
    parts.push(`cod_vendedor eq '${codVendedorFiltro}'`);
  }

  return parts.join(" and ");
}

const SELECT_MAP: Record<Endpoint, string> = {
  kpis: "numero_pedido,sku,data,cod_vendedor,cod_cliente,qtde_vendida,preco_unitario_prod,desconto_aplicado_prod,acao_nao_venda",
  pedidos: "numero_pedido,sku,data,hora_cadastro,razao_social,descricao_produto,qtde_vendida,preco_unitario_prod,desconto_aplicado_prod,situacao_pedido,nota_fiscal,cod_vendedor,nome_vendedor",
  "nao-vendas": "cod_cliente,razao_social,data,cod_vendedor,nome_vendedor,acao_nao_venda,motivo_nao_venda",
  ranking: "cod_vendedor,nome_vendedor,numero_pedido,preco_unitario_prod,qtde_vendida,desconto_aplicado_prod,acao_nao_venda",
};

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status >= 400 && res.status < 500) return res;
      if (res.ok) return res;
      lastError = new Error(`DAB retornou status ${res.status}`);
    } catch (e: any) {
      lastError = e;
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error("DAB indisponível");
}

async function fetchAllPages(
  endpointUrl: string,
  dabHeaders: Record<string, string>,
  params: Record<string, string>,
  maxPages = 10,
): Promise<any[]> {
  let url = `${endpointUrl}?${new URLSearchParams(params).toString()}`;
  const allItems: any[] = [];
  let pages = 0;

  while (url && pages < maxPages) {
    const res = await fetchWithRetry(url, { headers: dabHeaders });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DAB error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
    allItems.push(...items);
    pages++;
    const nextLink =
      json["@odata.nextLink"] ??
      json.nextLink ??
      res.headers.get("OData-NextLink") ??
      res.headers.get("x-ms-continuation") ??
      "";
    url = nextLink ? normalizeNextLink(nextLink, endpointUrl) : "";
  }

  return allItems;
}

// ──────────────────────────────────────────────────────────
// Cache (cockpit_cache_daily)
// ──────────────────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getCache(supabaseAdmin: any, key: string): Promise<CachePayload | null> {
  const { data } = await supabaseAdmin
    .from("cockpit_cache_daily")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.payload as CachePayload;
}

async function setCache(
  supabaseAdmin: any,
  key: string,
  payload: CachePayload,
  ttlMinutes: number,
) {
  await supabaseAdmin
    .from("cockpit_cache_daily")
    .upsert({ cache_key: key, payload, ttl_minutes: ttlMinutes }, { onConflict: "cache_key" });
}

// ──────────────────────────────────────────────────────────
// Agrega KPIs de dados DAB raw (fallback)
// ──────────────────────────────────────────────────────────
function aggregateKpisDab(items: any[]): KpiResult {
  const pedidosUnicos = new Set<string>();
  const clientesVisitados = new Set<string>();
  let faturamento = 0;
  let naoVendas = 0;

  for (const row of items) {
    const pedido = row.numero_pedido ?? row.nu_ped;
    const cliente = row.cod_cliente ?? row.cd_clien;
    const qtde = parseFloat(row.qtde_vendida ?? 0);
    const preco = parseFloat(row.preco_unitario_prod ?? 0);
    const desconto = parseFloat(row.desconto_aplicado_prod ?? 0);

    if (pedido) pedidosUnicos.add(String(pedido));
    if (cliente) clientesVisitados.add(String(cliente));
    faturamento += (preco - desconto) * qtde;
    if (row.acao_nao_venda) naoVendas++;
  }

  const totalPedidos = pedidosUnicos.size;
  return {
    faturamento_total: Math.round(faturamento * 100) / 100,
    total_pedidos: totalPedidos,
    ticket_medio: Math.round((totalPedidos > 0 ? faturamento / totalPedidos : 0) * 100) / 100,
    clientes_visitados: clientesVisitados.size,
    cobertura_pct: null,
    nao_vendas: naoVendas,
  };
}

// ──────────────────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) return respond({ error: "Token inválido" }, 401);
    const userId = userData.user.id;

    // 2. Parse body
    const body: QueryRequest = await req.json();
    const {
      endpoint,
      company_id,
      data_inicio,
      data_fim,
      page = 1,
      page_size = 50,
      cod_vendedor_filtro,
    } = body;

    if (!endpoint || !company_id || !data_inicio || !data_fim) {
      return respond(
        { error: "Parâmetros obrigatórios: endpoint, company_id, data_inicio, data_fim" },
        400,
      );
    }

    // 3. Resolve acesso (super_admin/ceo bypassa vínculo)
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (userRoles ?? []).map((r: any) => r.role as string);
    const isAdmin = roles.some((r) => ["super_admin", "ceo"].includes(r));

    let cod_vendedor: string;
    let nivel_acesso: NivelAcesso;

    if (isAdmin) {
      cod_vendedor = "";
      nivel_acesso = "diretoria";
    } else {
      const { data: vinculo, error: vinculoError } = await supabaseAdmin
        .from("cockpit_user_vendor_link")
        .select("cod_vendedor, nivel_acesso")
        .eq("user_id", userId)
        .eq("company_id", company_id)
        .eq("ativo", true)
        .maybeSingle();

      if (vinculoError) throw vinculoError;
      if (!vinculo) {
        return respond(
          { error: "Perfil não vinculado ao Cockpit de Vendas nesta empresa.", code: "NO_VENDOR_LINK" },
          403,
        );
      }
      cod_vendedor = (vinculo as any).cod_vendedor;
      nivel_acesso = (vinculo as any).nivel_acesso as NivelAcesso;
    }

    // 4. Cache (curto prazo para KPIs/ranking via sync)
    const cacheInput = JSON.stringify({
      endpoint, company_id, data_inicio, data_fim,
      nivel_acesso, cod_vendedor, page, page_size, cod_vendedor_filtro,
    });
    const cacheKey = await sha256hex(cacheInput);
    const ttlMinutes = (endpoint === "kpis" || endpoint === "ranking") ? 10 : 5;

    const cached = await getCache(supabaseAdmin, cacheKey);
    if (cached) return respond(cached);

    let result: CachePayload;

    // 5. KPIs e Ranking: lê do cockpit_vendas_sync se disponível
    if (endpoint === "kpis" || endpoint === "ranking") {
      const syncCovered = await isSyncCovered(supabaseAdmin, company_id, data_inicio, data_fim);

      if (syncCovered) {
        // Caminho rápido: dados do Supabase (<100ms)
        const syncResult = await queryFromSync(
          supabaseAdmin,
          endpoint,
          company_id,
          data_inicio,
          data_fim,
          nivel_acesso,
          cod_vendedor,
          cod_vendedor_filtro,
        );
        if (syncResult) {
          await setCache(supabaseAdmin, cacheKey, syncResult, ttlMinutes);
          return respond(syncResult);
        }
      }

      // Sem dados sincronizados: dispara sync em background
      console.log(`[cockpit-vendas-query] Sem sync para ${data_inicio}~${data_fim}. Disparando sync background.`);
      triggerSyncBackground(company_id, data_inicio, data_fim);

      // Diretoria sem filtro de vendedor = query pesada demais para DAB em tempo real.
      // Retorna vazio com flag sync_pending para o front exibir mensagem adequada.
      if (nivel_acesso === "diretoria" && !cod_vendedor_filtro) {
        const emptyResult: CachePayload = {
          kpis: endpoint === "kpis"
            ? { faturamento_total: 0, total_pedidos: 0, ticket_medio: 0, clientes_visitados: 0, cobertura_pct: null, nao_vendas: 0 }
            : undefined,
          items: endpoint === "ranking" ? [] : undefined,
          cached_at: new Date().toISOString(),
          fonte: "dab",
          sync_pending: true,
        } as any;
        return respond(emptyResult);
      }

      // Vendedor/Supervisor/Gerente: escopo pequeno → DAB é rápido
      const dab = await getQueryConfig(supabaseAdmin);
      const filter = buildFilter(nivel_acesso, cod_vendedor, data_inicio, data_fim, cod_vendedor_filtro);

      let items: any[];
      const $select = SELECT_MAP[endpoint];

      if (endpoint === "ranking") {
        const apply =
          `filter(${filter})/groupby((cod_vendedor,nome_vendedor),` +
          `aggregate(preco_unitario_prod with sum as soma_preco,` +
          `desconto_aplicado_prod with sum as soma_desc,` +
          `qtde_vendida with sum as soma_qtde,` +
          `numero_pedido with countdistinct as total_pedidos,` +
          `acao_nao_venda with countdistinct as count_nao_venda))`;
        const res = await fetchWithRetry(
          `${dab.endpointUrl}?$apply=${encodeURIComponent(apply)}`,
          { headers: dab.headers },
        );
        if (!res.ok) {
          console.warn("[cockpit] $apply ranking falhou, fallback raw");
          items = await fetchAllPages(dab.endpointUrl, dab.headers, { $filter: filter, $select, $first: "1000" }, 5);
        } else {
          const json = await res.json();
          items = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
        }
      } else {
        // KPIs $apply
        const apply =
          `filter(${filter})/groupby((numero_pedido,cod_cliente,cod_vendedor,acao_nao_venda),` +
          `aggregate(preco_unitario_prod with sum as soma_preco,` +
          `desconto_aplicado_prod with sum as soma_desc,` +
          `qtde_vendida with sum as soma_qtde))`;
        const res = await fetchWithRetry(
          `${dab.endpointUrl}?$apply=${encodeURIComponent(apply)}`,
          { headers: dab.headers },
        );
        if (!res.ok) {
          console.warn("[cockpit] $apply kpis falhou, fallback raw");
          items = await fetchAllPages(dab.endpointUrl, dab.headers, { $filter: filter, $select, $first: "1000" }, 5);
        } else {
          const json = await res.json();
          items = Array.isArray(json) ? json : (json.value ?? json.data ?? []);
        }
      }

      if (endpoint === "kpis") {
        const usandoApply = items[0] && "soma_preco" in items[0];
        let kpis: KpiResult;
        if (usandoApply) {
          const pedidosUnicos = new Set<string>();
          const clientesVisitados = new Set<string>();
          let faturamento = 0;
          let naoVendas = 0;
          for (const row of items) {
            if (row.numero_pedido) pedidosUnicos.add(String(row.numero_pedido));
            if (row.cod_cliente) clientesVisitados.add(String(row.cod_cliente));
            faturamento +=
              (parseFloat(row.soma_preco ?? 0) - parseFloat(row.soma_desc ?? 0)) *
              parseFloat(row.soma_qtde ?? 1);
            if (row.acao_nao_venda) naoVendas++;
          }
          const totalPedidos = pedidosUnicos.size;
          kpis = {
            faturamento_total: Math.round(faturamento * 100) / 100,
            total_pedidos: totalPedidos,
            ticket_medio: Math.round((totalPedidos > 0 ? faturamento / totalPedidos : 0) * 100) / 100,
            clientes_visitados: clientesVisitados.size,
            cobertura_pct: null,
            nao_vendas: naoVendas,
          };
        } else {
          kpis = aggregateKpisDab(items);
        }
        result = { kpis, cached_at: new Date().toISOString(), fonte: "dab" };
      } else {
        // Ranking fallback
        const usandoApply = items[0] && ("soma_preco" in items[0] || "total_pedidos" in items[0]);
        let ranking: any[];
        if (usandoApply) {
          ranking = items
            .map((row: any) => ({
              cod_vendedor: row.cod_vendedor ?? "",
              nome_vendedor: row.nome_vendedor ?? row.cod_vendedor ?? "",
              faturamento: Math.round(
                ((parseFloat(row.soma_preco ?? 0) - parseFloat(row.soma_desc ?? 0)) *
                  parseFloat(row.soma_qtde ?? 1)) *
                  100,
              ) / 100,
              total_pedidos: row.total_pedidos ?? 0,
              nao_vendas: row.count_nao_venda ?? 0,
            }))
            .sort((a: any, b: any) => b.faturamento - a.faturamento);
        } else {
          const byVendedor = new Map<string, { nome: string; faturamento: number; pedidos: Set<string>; naoVendas: number }>();
          for (const row of items) {
            const cod = row.cod_vendedor ?? "";
            const nome = row.nome_vendedor ?? cod;
            if (!byVendedor.has(cod)) byVendedor.set(cod, { nome, faturamento: 0, pedidos: new Set(), naoVendas: 0 });
            const entry = byVendedor.get(cod)!;
            if (row.numero_pedido) entry.pedidos.add(String(row.numero_pedido));
            entry.faturamento +=
              (parseFloat(row.preco_unitario_prod ?? 0) - parseFloat(row.desconto_aplicado_prod ?? 0)) *
              parseFloat(row.qtde_vendida ?? 0);
            if (row.acao_nao_venda) entry.naoVendas++;
          }
          ranking = Array.from(byVendedor.entries())
            .map(([cod, v]) => ({
              cod_vendedor: cod,
              nome_vendedor: v.nome,
              faturamento: Math.round(v.faturamento * 100) / 100,
              total_pedidos: v.pedidos.size,
              nao_vendas: v.naoVendas,
            }))
            .sort((a, b) => b.faturamento - a.faturamento);
        }
        result = { items: ranking, cached_at: new Date().toISOString(), fonte: "dab" };
      }
    } else {
      // 6. Pedidos e Não-Vendas: sempre via DAB (escopo pequeno = rápido)
      const dab = await getQueryConfig(supabaseAdmin);
      const filter = buildFilter(nivel_acesso, cod_vendedor, data_inicio, data_fim, cod_vendedor_filtro);
      const $select = SELECT_MAP[endpoint];
      const offset = (page - 1) * page_size;

      const items = await fetchAllPages(
        dab.endpointUrl,
        dab.headers,
        { $filter: filter, $select, $first: String(page_size + 1), $skip: String(offset) },
        2,
      );
      const filtered = endpoint === "nao-vendas" ? items.filter((r) => r.acao_nao_venda) : items;
      const hasMore = filtered.length > page_size;
      result = {
        items: filtered.slice(0, page_size),
        pagination: { page, page_size, total_items: offset + filtered.length, has_more: hasMore },
        cached_at: new Date().toISOString(),
        fonte: "dab",
      };
    }

    // 7. Salva cache e retorna
    await setCache(supabaseAdmin, cacheKey, result, ttlMinutes);
    return respond(result);
  } catch (err: any) {
    console.error("[cockpit-vendas-query]", err);
    return respond({ error: err.message ?? "Erro interno" }, 500);
  }
});
