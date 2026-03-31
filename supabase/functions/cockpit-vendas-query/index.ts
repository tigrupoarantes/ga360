// @ts-nocheck
// cockpit-vendas-query — Edge Function para o Cockpit de Vendas (multi-tenant)
//
// Fontes:
//   - Chok Distribuidora: gold.vw_venda_diaria_chokdist via DAB (query cockpit_vendas_chokdist)
//   - Outras empresas:    dbo.vw_sales_product_detail_api via DAB (fallback genérico com tenant_id)
//
// Endpoint e credenciais lidos de dl_queries + dl_connections (/admin/datalake)
// Limitação Chok: DAB sem índice na coluna 'data' → queries sem filtro de pessoa timeout.
// Estratégia Chok: diretoria sem filtro → retorna sync_pending; todos os outros → DAB com escopo.
// Estratégia genérica: usa sales_product_detail com $filter=tenant_id eq '{code}'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

type Endpoint = "kpis" | "pedidos" | "nao-vendas" | "ranking";
type NivelAcesso = "vendedor" | "supervisor" | "gerente" | "diretoria";

interface QueryRequest {
  endpoint: Endpoint;
  company_id: string;
  data_inicio: string;
  data_fim: string;
  page?: number;
  page_size?: number;
  cod_vendedor_filtro?: string;
  /** Código do tenant no DAB (ex: "5"). Se presente, tenta query genérica se Chok não disponível */
  tenant_id?: string;
}

interface KpiResult {
  faturamento_total: number;
  total_pedidos: number;
  ticket_medio: number;
  clientes_visitados: number;
  cobertura_pct: number | null;
  nao_vendas: number;
}

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
    headersJson["X-API-Key"] || headersJson["x-api-key"] ||
    authConfig.apiKey || authConfig.api_key;

  const headers: Record<string, string> = { "Accept": "application/json" };
  for (const [k, v] of Object.entries(headersJson)) {
    if (k && v != null) headers[k] = String(v);
  }
  if (apiKey && !headers["X-API-Key"]) headers["X-API-Key"] = apiKey;

  const baseUrl = conn.base_url.replace(/\/+$/, "");
  const endpointPath = query.endpoint_path.startsWith("/") ? query.endpoint_path : `/${query.endpoint_path}`;

  return { endpointUrl: `${baseUrl}${endpointPath}`, headers, baseUrl };
}

/** Config genérica: usa sales_product_detail com tenant_id para empresas não-Chok */
async function getGenericConfig(supabaseAdmin: any) {
  const { data: conn, error } = await supabaseAdmin
    .from("dl_connections")
    .select("*")
    .eq("is_enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !conn) throw new Error("Nenhuma dl_connection habilitada encontrada");

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
  return { endpointUrl: `${baseUrl}/sales_product_detail`, headers, baseUrl };
}

/** Monta $filter OData para endpoint genérico (sales_product_detail) */
function buildGenericFilter(tenantId: string, dataInicio: string, dataFim: string): string {
  return `tenant_id eq '${tenantId}' and dt_venda ge '${dataInicio}' and dt_venda le '${dataFim}'`;
}

/** Agrega KPIs a partir de dados genéricos (sales_product_detail) */
function aggregateGenericKpis(items: any[]): KpiResult {
  const pedidos = new Set<string>();
  let faturamento = 0;

  for (const row of items) {
    if (row.id_pedido) pedidos.add(String(row.id_pedido));
    faturamento += parseFloat(row.vl_venda || 0);
  }

  const totalPedidos = pedidos.size;
  return {
    faturamento_total: Math.round(faturamento * 100) / 100,
    total_pedidos: totalPedidos,
    ticket_medio: Math.round((totalPedidos > 0 ? faturamento / totalPedidos : 0) * 100) / 100,
    clientes_visitados: 0,
    cobertura_pct: null,
    nao_vendas: 0,
  };
}

// ──────────────────────────────────────────────────────────
// Helpers DAB
// ──────────────────────────────────────────────────────────

/** Monta $filter OData: período + escopo de acesso */
function buildFilter(
  nivelAcesso: NivelAcesso,
  codVendedor: string,
  dataInicio: string,
  dataFim: string,
  codVendedorFiltro?: string,
): string {
  const parts: string[] = [];
  // Campo 'data' é DateTimeOffset — sem aspas, com timezone UTC
  parts.push(`(data ge ${dataInicio}T00:00:00Z and data le ${dataFim}T23:59:59Z)`);

  if (codVendedorFiltro) {
    parts.push(`cod_vendedor eq '${codVendedorFiltro}'`);
  } else if (nivelAcesso === "vendedor") {
    parts.push(`cod_vendedor eq '${codVendedor}'`);
  } else if (nivelAcesso === "supervisor") {
    parts.push(`cod_supervisor eq '${codVendedor}'`);
  } else if (nivelAcesso === "gerente") {
    parts.push(`cod_gerente eq '${codVendedor}'`);
  }
  // diretoria sem filtro: somente data (lento — não usar)

  return parts.join(" and ");
}

const SELECT_MAP: Record<Endpoint, string> = {
  kpis: "numero_pedido,data,cod_vendedor,cod_cliente,qtde_vendida,preco_unitario_prod,desconto_aplicado_prod,acao_nao_venda",
  pedidos: "numero_pedido,sku,data,hora_cadastro,razao_social,descricao_produto,qtde_vendida,preco_unitario_prod,desconto_aplicado_prod,situacao_pedido,nota_fiscal,cod_vendedor,nome_vendedor",
  "nao-vendas": "cod_cliente,razao_social,data,cod_vendedor,nome_vendedor,acao_nao_venda,motivo_nao_venda",
  ranking: "cod_vendedor,nome_vendedor,numero_pedido,preco_unitario_prod,qtde_vendida,desconto_aplicado_prod,acao_nao_venda",
};

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status >= 400 && res.status < 500) return res; // não retentar 4xx
      if (res.ok) return res;
      lastError = new Error(`DAB status ${res.status}`);
    } catch (e: any) {
      lastError = e;
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError ?? new Error("DAB indisponível");
}

async function fetchAllPages(
  endpointUrl: string,
  dabHeaders: Record<string, string>,
  params: Record<string, string>,
  maxPages = 5,
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
      json["@odata.nextLink"] ?? json.nextLink ??
      res.headers.get("OData-NextLink") ?? res.headers.get("x-ms-continuation") ?? "";

    if (nextLink) {
      const nl = /^https?:\/\//i.test(nextLink)
        ? nextLink.replace(/\/api\//i, "/v1/")
        : `${endpointUrl}${nextLink.startsWith("/") ? nextLink : "/" + nextLink}`.replace(/\/api\//i, "/v1/");
      url = nl;
    } else {
      url = "";
    }
  }

  return allItems;
}

// ──────────────────────────────────────────────────────────
// Agregação de KPIs
// ──────────────────────────────────────────────────────────
function aggregateKpis(items: any[]): KpiResult {
  const pedidos = new Set<string>();
  const clientes = new Set<string>();
  let faturamento = 0;
  let naoVendas = 0;

  for (const row of items) {
    const pedido = row.numero_pedido;
    const cliente = row.cod_cliente;
    const qtde = parseFloat(row.qtde_vendida ?? 0);
    const preco = parseFloat(row.preco_unitario_prod ?? 0);
    const desc = parseFloat(row.desconto_aplicado_prod ?? 0);

    if (pedido) pedidos.add(String(pedido));
    if (cliente) clientes.add(String(cliente));
    faturamento += (preco - desc) * qtde;
    if (row.acao_nao_venda) naoVendas++;
  }

  const totalPedidos = pedidos.size;
  return {
    faturamento_total: Math.round(faturamento * 100) / 100,
    total_pedidos: totalPedidos,
    ticket_medio: Math.round((totalPedidos > 0 ? faturamento / totalPedidos : 0) * 100) / 100,
    clientes_visitados: clientes.size,
    cobertura_pct: null,
    nao_vendas: naoVendas,
  };
}

// ──────────────────────────────────────────────────────────
// Cache
// ──────────────────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getCache(supabaseAdmin: any, key: string): Promise<any | null> {
  const { data } = await supabaseAdmin
    .from("cockpit_cache_daily")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.payload;
}

async function setCache(supabaseAdmin: any, key: string, payload: any, ttlMinutes: number) {
  await supabaseAdmin
    .from("cockpit_cache_daily")
    .upsert({ cache_key: key, payload, ttl_minutes: ttlMinutes }, { onConflict: "cache_key" });
}

// ──────────────────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
    const { endpoint, company_id, data_inicio, data_fim, page = 1, page_size = 50, cod_vendedor_filtro } = body;

    if (!endpoint || !company_id || !data_inicio || !data_fim) {
      return respond({ error: "Parâmetros obrigatórios: endpoint, company_id, data_inicio, data_fim" }, 400);
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
        return respond({ error: "Perfil não vinculado ao Cockpit de Vendas nesta empresa.", code: "NO_VENDOR_LINK" }, 403);
      }
      cod_vendedor = (vinculo as any).cod_vendedor;
      nivel_acesso = (vinculo as any).nivel_acesso as NivelAcesso;
    }

    // 4. Diretoria sem filtro de vendedor → DAB faz full scan (>30s). Não chamar.
    //    Retorna indicador para o front exibir orientação ao usuário.
    const isDiretoriaSemFiltro = nivel_acesso === "diretoria" && !cod_vendedor_filtro;
    if (isDiretoriaSemFiltro && (endpoint === "kpis" || endpoint === "ranking")) {
      const result = {
        kpis: endpoint === "kpis"
          ? { faturamento_total: 0, total_pedidos: 0, ticket_medio: 0, clientes_visitados: 0, cobertura_pct: null, nao_vendas: 0 }
          : undefined,
        items: endpoint === "ranking" ? [] : undefined,
        cached_at: new Date().toISOString(),
        sync_pending: true,
      };
      return respond(result);
    }

    // 5. Cache
    const cacheInput = JSON.stringify({ endpoint, company_id, data_inicio, data_fim, nivel_acesso, cod_vendedor, page, page_size, cod_vendedor_filtro });
    const cacheKey = await sha256hex(cacheInput);
    const ttlMinutes = (endpoint === "kpis" || endpoint === "ranking") ? 15 : 5;

    const cached = await getCache(supabaseAdmin, cacheKey);
    if (cached) return respond(cached);

    // 6. Resolve endpoint DAB — Chok-specific ou genérico multi-tenant
    let useGeneric = false;
    let dab: { endpointUrl: string; headers: Record<string, string>; baseUrl: string };
    try {
      dab = await getQueryConfig(supabaseAdmin);
    } catch (_e) {
      // Query Chok não configurada — usar fallback genérico
      if (body.tenant_id) {
        dab = await getGenericConfig(supabaseAdmin);
        useGeneric = true;
      } else {
        throw _e;
      }
    }

    // Se tenant_id informado e não é Chok, usar genérico
    if (body.tenant_id && !useGeneric) {
      // Verifica se é Chok consultando company
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", company_id)
        .maybeSingle();
      const isChok = company?.name?.toLowerCase().includes("chok");
      if (!isChok) {
        dab = await getGenericConfig(supabaseAdmin);
        useGeneric = true;
      }
    }

    let filter: string;
    let $select: string;

    if (useGeneric) {
      // Endpoint genérico: sales_product_detail com tenant_id
      filter = buildGenericFilter(body.tenant_id!, data_inicio, data_fim);
      $select = "id_pedido,dt_venda,vl_venda,tenant_id";
    } else {
      // Endpoint Chok: venda_diaria_chokdist com filtro de pessoa
      filter = buildFilter(nivel_acesso, cod_vendedor, data_inicio, data_fim, cod_vendedor_filtro);
      $select = SELECT_MAP[endpoint];
    }

    let result: any;

    if (endpoint === "kpis") {
      const items = await fetchAllPages(dab.endpointUrl, dab.headers, { $filter: filter, $select, $first: "2000" }, 10);
      const kpis = useGeneric ? aggregateGenericKpis(items) : aggregateKpis(items);
      result = { kpis, cached_at: new Date().toISOString(), source: useGeneric ? "generic" : "chok" };
    } else if (endpoint === "ranking") {
      const items = await fetchAllPages(dab.endpointUrl, dab.headers, { $filter: filter, $select, $first: "2000" }, 10);

      // Agrega por vendedor
      const byVendedor = new Map<string, { nome: string; faturamento: number; pedidos: Set<string>; naoVendas: number }>();
      for (const row of items) {
        const cod = row.cod_vendedor ?? "";
        if (!byVendedor.has(cod)) byVendedor.set(cod, { nome: row.nome_vendedor ?? cod, faturamento: 0, pedidos: new Set(), naoVendas: 0 });
        const entry = byVendedor.get(cod)!;
        if (row.numero_pedido) entry.pedidos.add(String(row.numero_pedido));
        entry.faturamento += (parseFloat(row.preco_unitario_prod ?? 0) - parseFloat(row.desconto_aplicado_prod ?? 0)) * parseFloat(row.qtde_vendida ?? 0);
        if (row.acao_nao_venda) entry.naoVendas++;
      }

      const ranking = Array.from(byVendedor.entries())
        .map(([cod, v]) => ({
          cod_vendedor: cod,
          nome_vendedor: v.nome,
          faturamento: Math.round(v.faturamento * 100) / 100,
          total_pedidos: v.pedidos.size,
          nao_vendas: v.naoVendas,
        }))
        .sort((a, b) => b.faturamento - a.faturamento);

      result = { items: ranking, cached_at: new Date().toISOString() };
    } else {
      // pedidos / nao-vendas: paginado
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
      };
    }

    await setCache(supabaseAdmin, cacheKey, result, ttlMinutes);
    return respond(result);
  } catch (err: any) {
    console.error("[cockpit-vendas-query]", err);
    return respond({ error: err.message ?? "Erro interno" }, 500);
  }
});
