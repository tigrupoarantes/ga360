// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface VerbaRecord {
  company_id?: string;
  company_external_id?: string;
  cnpj_empresa?: string;
  razao_social?: string;
  cpf?: string;
  nome_funcionario?: string;
  nome?: string;
  ano?: number;
  mes?: number;
  cod_evento?: number;
  valor?: number | string;
}

interface SyncRequest {
  source_system?: string;
  company_external_id?: string;
  records?: VerbaRecord[];
  events?: VerbaRecord[];
  load_from_datalake?: boolean;
  query_id?: string;
  connection_id?: string;
  endpoint_path?: string;
  query_params?: Record<string, string | number | boolean>;
  max_pages?: number;
}

interface DatalakeConnection {
  id: string;
  base_url: string;
  headers_json?: Record<string, unknown>;
  auth_config_json?: Record<string, unknown>;
  is_enabled: boolean;
}

interface DatalakeQuery {
  id: string;
  connection_id: string;
  endpoint_path: string;
  is_enabled: boolean;
  name?: string;
}

function normalizeDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCnpj(value?: string | null) {
  const digits = normalizeDigits(value);
  return digits.length === 14 ? digits : null;
}

function normalizeCpf(value?: string | null) {
  const digits = normalizeDigits(value);
  return digits.length === 11 ? digits : null;
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveApiKeyFromConnection(record: DatalakeConnection): string | undefined {
  const headersJson = record.headers_json || {};
  const authConfigJson = record.auth_config_json || {};
  const customHeaderName = String(authConfigJson.authHeaderName || "").trim();

  return (
    (customHeaderName ? String(headersJson[customHeaderName] || "") : "") ||
    String(headersJson["X-API-Key"] || "") ||
    String(headersJson["x-api-key"] || "") ||
    String(authConfigJson.apiKey || "") ||
    String(authConfigJson.api_key || "") ||
    undefined
  );
}

function resolveAuthHeaderFromConnection(record: DatalakeConnection): string | undefined {
  const authConfigJson = record.auth_config_json || {};
  if (authConfigJson.bearerToken) return `Bearer ${String(authConfigJson.bearerToken)}`;
  if (authConfigJson.token) return `Bearer ${String(authConfigJson.token)}`;
  return undefined;
}

function resolveAuthHeaderNameFromConnection(record: DatalakeConnection): string | undefined {
  const authConfigJson = record.auth_config_json || {};
  return authConfigJson.authHeaderName ? String(authConfigJson.authHeaderName) : undefined;
}

function resolveHeadersFromConnection(record: DatalakeConnection): Record<string, string> {
  const headersJson = record.headers_json || {};
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(headersJson)) {
    if (!key || value === undefined || value === null) continue;
    headers[key] = String(value);
  }

  return headers;
}

function buildDatalakeUrl(baseUrl: string, endpointPath: string, queryParams?: Record<string, string | number | boolean>) {
  const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedPath = String(endpointPath || "").trim().replace(/^\/+/, "");
  const url = new URL(normalizedPath, `${normalizedBase}/`);

  for (const [key, value] of Object.entries(queryParams || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function extractRowsFromDatalakeBody(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];

  const candidates = [
    body.value,
    body.values,
    body.data,
    body.rows,
    body.items,
    body.result,
    body.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function extractNextLink(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  return (
    body.nextLink ||
    body.next_link ||
    body["@nextLink"] ||
    body["@odata.nextLink"] ||
    null
  );
}

function pickField(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }

    const upper = key.toUpperCase();
    if (source[upper] !== undefined && source[upper] !== null && source[upper] !== "") {
      return source[upper];
    }

    const lower = key.toLowerCase();
    if (source[lower] !== undefined && source[lower] !== null && source[lower] !== "") {
      return source[lower];
    }
  }

  return undefined;
}

function mapDatalakeRowToVerbaRecord(row: Record<string, any>): VerbaRecord {
  return {
    company_id: pickField(row, ["company_id"]),
    company_external_id: pickField(row, ["company_external_id", "external_id_empresa", "cnpj_empresa"]),
    cnpj_empresa: pickField(row, ["cnpj_empresa", "cnpj"]),
    razao_social: pickField(row, ["razao_social", "empresa", "nome_empresa"]),
    cpf: pickField(row, ["cpf", "cpf_funcionario"]),
    nome_funcionario: pickField(row, ["nome_funcionario", "funcionario", "nome", "nome_colaborador"]),
    ano: pickField(row, ["ano"]),
    mes: pickField(row, ["mes"]),
    cod_evento: pickField(row, ["cod_evento", "codigo_evento", "evento", "codevento"]),
    valor: pickField(row, ["valor", "valor_evento", "valor_bruto", "valor_liquido"]),
  };
}

async function resolveConnectionAndEndpoint(
  supabase: ReturnType<typeof createClient>,
  body: SyncRequest,
): Promise<{ connection: DatalakeConnection; endpointPath: string; queryName: string }> {
  if (body.connection_id && body.endpoint_path) {
    const { data: explicitConnection, error: explicitConnectionError } = await supabase
      .from("dl_connections")
      .select("id, base_url, headers_json, auth_config_json, is_enabled")
      .eq("id", body.connection_id)
      .eq("is_enabled", true)
      .maybeSingle();

    if (explicitConnectionError || !explicitConnection) {
      throw new Error("Conexão Datalake informada não encontrada ou inativa.");
    }

    return {
      connection: explicitConnection as DatalakeConnection,
      endpointPath: String(body.endpoint_path),
      queryName: "manual_endpoint",
    };
  }

  let queryFilter = supabase
    .from("dl_queries")
    .select("id, connection_id, endpoint_path, is_enabled, name")
    .eq("is_enabled", true);

  if (body.query_id) {
    queryFilter = queryFilter.eq("id", body.query_id);
  }

  const { data: queries, error: queriesError } = await queryFilter.order("updated_at", { ascending: false }).limit(20);

  if (queriesError) throw new Error(`Falha ao buscar query Datalake: ${queriesError.message}`);

  const selectedQuery = (queries || []).find((query: any) => {
    if (body.query_id) return true;
    const text = `${query.name || ""} ${query.endpoint_path || ""}`.toLowerCase();
    return text.includes("verba") || text.includes("folha") || text.includes("pagamento") || text.includes("evento");
  });

  if (!selectedQuery) {
    throw new Error("Nenhuma query de VERBAS encontrada em dl_queries. Informe query_id ou endpoint_path.");
  }

  const { data: connection, error: connectionError } = await supabase
    .from("dl_connections")
    .select("id, base_url, headers_json, auth_config_json, is_enabled")
    .eq("id", selectedQuery.connection_id)
    .eq("is_enabled", true)
    .maybeSingle();

  if (connectionError || !connection) {
    throw new Error("Conexão da query de VERBAS não encontrada ou inativa.");
  }

  return {
    connection: connection as DatalakeConnection,
    endpointPath: String(selectedQuery.endpoint_path || "").trim(),
    queryName: String(selectedQuery.name || selectedQuery.id),
  };
}

async function loadRowsFromDatalake(
  supabase: ReturnType<typeof createClient>,
  body: SyncRequest,
): Promise<{ records: VerbaRecord[]; meta: Record<string, unknown> }> {
  const resolved = await resolveConnectionAndEndpoint(supabase, body);
  const { connection, endpointPath, queryName } = resolved;

  const apiKey = resolveApiKeyFromConnection(connection);
  const authHeader = resolveAuthHeaderFromConnection(connection);
  const authHeaderName = resolveAuthHeaderNameFromConnection(connection) || "X-API-Key";
  const customHeaders = resolveHeadersFromConnection(connection);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...customHeaders,
  };
  if (apiKey) headers[authHeaderName] = apiKey;
  if (authHeader) headers.Authorization = authHeader;

  const maxPages = Math.max(1, Math.min(100, Number(body.max_pages || 20)));
  let currentUrl = buildDatalakeUrl(connection.base_url, endpointPath, body.query_params);
  const collected: VerbaRecord[] = [];

  for (let page = 1; page <= maxPages && currentUrl; page++) {
    const response = await fetch(currentUrl, { method: "GET", headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(`Datalake retornou ${response.status} na página ${page}: ${JSON.stringify(payload)}`);
    }

    const rows = extractRowsFromDatalakeBody(payload);
    collected.push(...rows.map(mapDatalakeRowToVerbaRecord));

    const nextLink = extractNextLink(payload);
    currentUrl = nextLink ? new URL(nextLink, currentUrl).toString() : "";
  }

  return {
    records: collected,
    meta: {
      query_name: queryName,
      connection_id: connection.id,
      endpoint_path: endpointPath,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("SYNC_API_KEY");

    if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    const sourceSystem = body.source_system || "gestao_ativos";
    const directRecords = Array.isArray(body.records) ? body.records : (Array.isArray(body.events) ? body.events : []);

    let records = directRecords;
    let datalakeMeta: Record<string, unknown> | undefined;

    if (!records.length && body.load_from_datalake !== false) {
      const loaded = await loadRowsFromDatalake(supabase, body);
      records = loaded.records;
      datalakeMeta = loaded.meta;
    }

    if (!records.length) {
      return new Response(
        JSON.stringify({ error: "Nenhum dado encontrado. Envie records[]/events[] ou configure load_from_datalake/query_id/endpoint_path." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, external_id, name");

    if (companiesError) {
      throw new Error(`Failed to load companies: ${companiesError.message}`);
    }

    const companyByExternalId = new Map<string, { id: string; name: string | null }>();
    for (const company of companies || []) {
      const normalized = normalizeCnpj(company.external_id);
      if (normalized) {
        companyByExternalId.set(normalized, { id: company.id, name: company.name || null });
      }
    }

    const fallbackExternalId = normalizeCnpj(body.company_external_id || null);
    const fallbackCompany = fallbackExternalId ? companyByExternalId.get(fallbackExternalId) : null;

    let processed = 0;
    let failed = 0;
    const errors: Array<Record<string, unknown>> = [];
    const upsertRows: Array<Record<string, unknown>> = [];

    for (let index = 0; index < records.length; index++) {
      const item = records[index];

      try {
        const cpf = normalizeCpf(item.cpf);
        const ano = parseNumber(item.ano);
        const mes = parseNumber(item.mes);
        const codEvento = parseNumber(item.cod_evento);
        const valor = parseNumber(item.valor) ?? 0;

        if (!cpf) throw new Error("CPF inválido");
        if (!ano || ano < 2000) throw new Error("Ano inválido");
        if (!mes || mes < 1 || mes > 12) throw new Error("Mês inválido");
        if (!codEvento) throw new Error("cod_evento inválido");

        const normalizedExternalId = normalizeCnpj(item.company_external_id || item.cnpj_empresa || null);
        const mappedCompany = normalizedExternalId
          ? companyByExternalId.get(normalizedExternalId)
          : null;

        const companyId = item.company_id || mappedCompany?.id || fallbackCompany?.id || null;
        if (!companyId) throw new Error("Empresa não encontrada (company_id/company_external_id)");

        upsertRows.push({
          company_id: companyId,
          razao_social: item.razao_social || mappedCompany?.name || fallbackCompany?.name || "SEM_RAZAO_SOCIAL",
          cpf,
          nome_funcionario: (item.nome_funcionario || item.nome || "NOME_NAO_INFORMADO").trim(),
          ano: Number(ano),
          mes: Number(mes),
          cod_evento: Number(codEvento),
          valor: Number(valor),
          updated_at: new Date().toISOString(),
        });

        processed++;
      } catch (error) {
        failed++;
        errors.push({ index, item, error: String(error) });
      }
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("payroll_verba_events")
        .upsert(upsertRows, {
          onConflict: "company_id,cpf,ano,mes,cod_evento",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert payroll rows: ${upsertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        source_system: sourceSystem,
        received: records.length,
        processed,
        failed,
        upserted: upsertRows.length,
        duration_ms: Date.now() - startedAt,
        datalake: datalakeMeta,
        errors: errors.length ? errors.slice(0, 100) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
