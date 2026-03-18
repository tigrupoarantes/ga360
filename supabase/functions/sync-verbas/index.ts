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
  competencia?: string;
  periodo?: string;
  tipo_verba?: string;
  id_verba?: string;
  id_verba_long?: string;  // hash SHA2 — PK técnica do endpoint verbas-ga360
  nome_evento?: string;    // descrição do evento (ex: "SALARIO MENSAL")
  tenant_id?: string;      // razão social normalizada (ex: "CHOK_DISTRIBUIDORA_...")
}

interface SyncRequest {
  source_system?: string;
  company_id?: string;
  company_external_id?: string;
  department?: string;
  position?: string;
  records?: VerbaRecord[];
  events?: VerbaRecord[];
  load_from_datalake?: boolean;
  replace_scope?: boolean;
  query_id?: string;
  connection_id?: string;
  endpoint_path?: string;
  query_params?: Record<string, string | number | boolean>;
  max_pages?: number;
  all_pages?: boolean;
  target_month?: number;
  target_year?: number;
  job_id?: string;
  preview_only?: boolean;
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

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isMissingColumnError(err: unknown, columnName?: string) {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  if (!msg.includes("column") || !msg.includes("does not exist")) return false;
  return columnName ? msg.includes(String(columnName).toLowerCase()) : true;
}

function normalizeCompanyNameKey(value?: string | null) {
  const normalized = normalizeText(value)
    // Common upstream pattern: "RAZAO SOCIAL (6)" / "RAZAO SOCIAL - 6"
    // Strip trailing parenthetical / numeric codes to improve matching.
    .replace(/\(\s*\d+\s*\)\s*$/g, " ")
    .replace(/[-–—]\s*\d+\s*$/g, " ")
    .replace(/\s+\d+\s*$/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function getCompetenciaAsOfIso(ano: number, mes: number): string {
  // End-of-month UTC (month is 1..12). Using day=0 returns last day of previous month.
  const asOf = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
  return asOf.toISOString();
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  let normalized = raw
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  let parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;

  const tokenMatch = raw.match(/-?\d+[\d.,]*/);
  if (tokenMatch?.[0]) {
    const token = tokenMatch[0];
    const tokenHasComma = token.includes(",");
    const tokenHasDot = token.includes(".");
    let tokenNormalized = token;
    if (tokenHasComma && tokenHasDot) {
      tokenNormalized = tokenNormalized.replace(/\./g, "").replace(",", ".");
    } else if (tokenHasComma) {
      tokenNormalized = tokenNormalized.replace(",", ".");
    }
    parsed = Number(tokenNormalized);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number.isFinite(parsed) ? parsed : null;
}

function parseAnoMesFromText(value: unknown): { ano: number | null; mes: number | null } {
  const text = String(value || "").trim();
  if (!text) return { ano: null, mes: null };

  let match = text.match(/(20\d{2})[^0-9]?(0?[1-9]|1[0-2])/);
  if (match) {
    return { ano: Number(match[1]), mes: Number(match[2]) };
  }

  match = text.match(/(0?[1-9]|1[0-2])[^0-9]?(20\d{2})/);
  if (match) {
    return { ano: Number(match[2]), mes: Number(match[1]) };
  }

  const monthByName: Array<{ regex: RegExp; month: number }> = [
    { regex: /\bjan(eiro)?\b/i, month: 1 },
    { regex: /\bfev(ereiro)?\b/i, month: 2 },
    { regex: /\bmar(c|ç)o\b/i, month: 3 },
    { regex: /\babr(il)?\b/i, month: 4 },
    { regex: /\bmai(o)?\b/i, month: 5 },
    { regex: /\bjun(ho)?\b/i, month: 6 },
    { regex: /\bjul(ho)?\b/i, month: 7 },
    { regex: /\bago(sto)?\b/i, month: 8 },
    { regex: /\bset(embro)?\b/i, month: 9 },
    { regex: /\bout(ubro)?\b/i, month: 10 },
    { regex: /\bnov(embro)?\b/i, month: 11 },
    { regex: /\bdez(embro)?\b/i, month: 12 },
  ];
  const monthNamed = monthByName.find((entry) => entry.regex.test(text));
  const yearMatch = text.match(/(20\d{2})/);
  if (monthNamed && yearMatch) {
    return { ano: Number(yearMatch[1]), mes: monthNamed.month };
  }

  return { ano: null, mes: null };
}

function parseCodEvento(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed && Number.isFinite(parsed)) return Math.trunc(parsed);

  const text = String(value || "");
  const match = text.match(/\d{1,6}/);
  if (!match) return null;

  const code = Number(match[0]);
  return Number.isFinite(code) ? code : null;
}

const TIPO_VERBA_TO_COD_EVENTO: Record<string, number> = {
  SALDO_SALARIO: 1,
  COMPLEMENTO_SALARIAL: 10102,
  COMISSAO_DSR: 30,
  BONUS: 31,
  PREMIO: 10087,
  ADCNOT_HORAEXTRA_DSR: 61,
  VERBA_INDENIZATORIA: 10000,
  VALE_ALIMENTACAO: 10096,
  DESC_PLANO_SAUDE: 10008,
  PLANO_SAUDE_EMPRESA: 10098,
  SEGURO_VIDA: 10097,
  SST: 10100,
  FGTS: 995,
  OUTROS: 999999,
};

// Mapeamento direto cod_evento → tipo_verba (mesmo CASE da view gold.vw_pagamento_verba_pivot_mensal)
const COD_EVENTO_TO_TIPO: Record<number, string> = {
  1: "SALDO_SALARIO", 10095: "SALDO_SALARIO", 7: "SALDO_SALARIO",
  540: "SALDO_SALARIO", 541: "SALDO_SALARIO", 10088: "SALDO_SALARIO",
  10001: "SALDO_SALARIO", 10035: "SALDO_SALARIO", 10027: "SALDO_SALARIO",
  10063: "SALDO_SALARIO", 61: "SALDO_SALARIO", 87: "SALDO_SALARIO",
  51: "SALDO_SALARIO", 91: "SALDO_SALARIO", 10102: "SALDO_SALARIO", 23: "SALDO_SALARIO",
  30: "COMISSAO_DSR", 10044: "COMISSAO_DSR",
  31: "BONUS",
  10087: "PREMIO", 10114: "PREMIO",
  10000: "VERBA_INDENIZATORIA",
  10054: "ADIANTAMENTO_VERBA_IDENIZATORIA",
  10008: "DESC_PLANO_SAUDE", 10009: "DESC_PLANO_SAUDE",
  10098: "PLANO_SAUDE_EMPRESA",
  995: "FGTS", 996: "FGTS",
};

const MONTH_FIELDS = [
  "janeiro", "fevereiro", "marco", "abril",
  "maio", "junho", "julho", "agosto",
  "setembro", "outubro", "novembro", "dezembro",
] as const;

const MONTH_NUMBER_TO_FIELD: Record<number, string> = {
  1: "janeiro", 2: "fevereiro", 3: "marco", 4: "abril",
  5: "maio", 6: "junho", 7: "julho", 8: "agosto",
  9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
};

function normalizeTipoVerba(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_");
}

function toTenantId(razaoSocial: string): string {
  return razaoSocial
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function resolveCodEventoFromTipoVerba(value: unknown): number | null {
  const tipo = normalizeTipoVerba(value);
  if (!tipo) return null;
  return TIPO_VERBA_TO_COD_EVENTO[tipo] || null;
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

function sanitizeBaseUrl(rawBaseUrl: string) {
  let normalized = String(rawBaseUrl || "").trim();
  if (!normalized) return normalized;

  normalized = normalized.replace(/\/+$/, "");
  normalized = normalized
    .replace(/\/v1\/v1(\/|$)/i, "/v1$1")
    .replace(/\/api\/api(\/|$)/i, "/api$1")
    .replace(/\/v1\/api(\/|$)/i, "/v1$1");

  // Strip old verbas endpoint path segments that may be embedded in base_url
  // e.g. https://api.example.com/v1/verbas -> https://api.example.com
  // This allows auto-discovery to correctly build e.g. /v1/verbas-ga360
  normalized = normalized
    .replace(/\/(v1\/)?(api\/)?pagamentos\/verbas\/?$/i, "")
    .replace(/\/(v1\/)?(api\/)?folha\/verbas\/?$/i, "")
    .replace(/\/(v1\/)?(api\/)?verbas\/?$/i, "")
    .replace(/\/(v1\/)?(api\/)?eventos\/?$/i, "")
    .replace(/\/+$/, "");

  return normalized;
}

function applyQueryParams(url: URL, queryParams?: Record<string, string | number | boolean>) {
  for (const [key, value] of Object.entries(queryParams || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  if (!url.searchParams.has("$first")) {
    url.searchParams.set("$first", "500");
  }
}

function normalizeEndpointPath(path: string) {
  return String(path || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^api\//i, "")
    .replace(/^v1\//i, "")
    .split("?")[0]
    .toLowerCase();
}

function buildDatalakeUrls(
  baseUrl: string,
  endpointPath: string,
  queryParams?: Record<string, string | number | boolean>,
) {
  const sanitizedBase = sanitizeBaseUrl(baseUrl);
  const base = sanitizedBase.endsWith("/") ? sanitizedBase : `${sanitizedBase}/`;
  const baseUrlObject = new URL(base);
  const basePath = baseUrlObject.pathname.replace(/\/+$/, "").toLowerCase();
  const normalizedEndpoint = normalizeEndpointPath(endpointPath);

  const urls = new Set<string>();

  if (!normalizedEndpoint) {
    const direct = new URL(baseUrlObject.toString());
    applyQueryParams(direct, queryParams);
    urls.add(direct.toString());
    return [...urls];
  }

  if (
    basePath.endsWith(`/${normalizedEndpoint}`) ||
    basePath.endsWith(`/api/${normalizedEndpoint}`) ||
    basePath.endsWith(`/v1/${normalizedEndpoint}`) ||
    basePath.endsWith(`/v1/api/${normalizedEndpoint}`)
  ) {
    const direct = new URL(baseUrlObject.toString());
    applyQueryParams(direct, queryParams);
    urls.add(direct.toString());
  }

  const endpointCandidates: string[] = [];
  if (basePath.endsWith("/api") || basePath.endsWith("/v1/api")) {
    endpointCandidates.push(normalizedEndpoint);
  } else if (basePath.endsWith("/v1")) {
    endpointCandidates.push(normalizedEndpoint);
    endpointCandidates.push(`api/${normalizedEndpoint}`);
  } else {
    endpointCandidates.push(normalizedEndpoint);
    endpointCandidates.push(`api/${normalizedEndpoint}`);
    endpointCandidates.push(`v1/${normalizedEndpoint}`);
    endpointCandidates.push(`v1/api/${normalizedEndpoint}`);
  }

  for (const endpoint of endpointCandidates) {
    const url = new URL(endpoint, base);
    applyQueryParams(url, queryParams);
    urls.add(url.toString());
  }

  return [...urls];
}

function buildVerbasEndpointCandidates(explicitEndpointPath?: string | null) {
  const normalizedExplicit = String(explicitEndpointPath || "").trim().replace(/^\/+/, "");
  if (normalizedExplicit) return [normalizedExplicit];

  const envEndpoint = String(Deno.env.get("VERBAS_ENDPOINT_PATH") || "").trim().replace(/^\/+/, "");

  const defaults = [
    "v1/verbas-ga360",      // endpoint otimizado (LONG format, base_url sem /v1)
    "verbas-ga360",         // fallback se base_url já inclui /v1
    "api/verbas-ga360",     // fallback interno (upstream DAB direto)
    "verbas",
    "api/verbas",
    "v1/verbas",
    "folha/verbas",
    "api/folha/verbas",
    "eventos",
    "api/eventos",
    "folha/eventos",
    "api/folha/eventos",
    "pagamentos/verbas",
    "api/pagamentos/verbas",
  ];

  const candidates = [envEndpoint, ...defaults]
    .map((item) => String(item || "").trim().replace(/^\/+/, ""))
    .filter(Boolean);

  return [...new Set(candidates)];
}

function isImplicitPrimaryKeyError(payload: any): boolean {
  const message = String(payload?.error?.message || payload?.message || payload?.details || "").toLowerCase();
  return message.includes("implicit primary key") || message.includes("url template");
}

async function fetchJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  maxAttempts = 3,
): Promise<{ response: Response; payload: any }> {
  let lastResponse: Response | null = null;
  let lastPayload: any = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, { method: "GET", headers });
    const text = await response.text();
    let payload: any = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new Error(
          `Upstream retornou JSON inválido em ${url}: ${String((error as Error)?.message || error)} | ` +
          `preview=${JSON.stringify(String(text).slice(0, 4000))}`,
        );
      }
    }

    lastResponse = response;
    lastPayload = payload;

    if (!(response.status >= 500 && attempt < maxAttempts)) {
      return { response, payload };
    }

    const waitMs = 200 * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return { response: lastResponse as Response, payload: lastPayload };
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

function mapDatalakeRowToVerbaRecords(
  row: Record<string, any>,
  scope?: { targetMonth?: number | null; targetYear?: number | null },
): VerbaRecord[] {
  const targetMonth = scope?.targetMonth || null;
  const targetYear = scope?.targetYear || null;

  const competencia = pickField(row, [
    "competencia",
    "periodo",
    "ano_mes",
    "mes_ano",
    "competencia_referencia",
    "referencia",
  ]);

  const tipoVerba = pickField(row, ["tipo_verba", "tipoverba", "tipo", "verba_tipo"]);
  const idVerba = pickField(row, ["id_verba", "id"]);
  const codEventoRaw = pickField(row, ["cod_evento", "codigo_evento", "evento", "codevento", "rubrica", "cod_rubrica", "id_evento", "id_rubrica"]);
  const codEventoResolved = parseCodEvento(codEventoRaw) || resolveCodEventoFromTipoVerba(tipoVerba);

  const monthlyValues: Array<{ mes: number; valor: number }> = [
    { mes: 1, valor: parseNumber(pickField(row, ["janeiro", "Janeiro", "jan", "JAN"])) as number },
    { mes: 2, valor: parseNumber(pickField(row, ["fevereiro", "Fevereiro", "fev", "FEV"])) as number },
    { mes: 3, valor: parseNumber(pickField(row, ["marco", "Marco", "março", "Março", "mar", "MAR"])) as number },
    { mes: 4, valor: parseNumber(pickField(row, ["abril", "Abril", "abr", "ABR"])) as number },
    { mes: 5, valor: parseNumber(pickField(row, ["maio", "Maio", "mai", "MAI"])) as number },
    { mes: 6, valor: parseNumber(pickField(row, ["junho", "Junho", "jun", "JUN"])) as number },
    { mes: 7, valor: parseNumber(pickField(row, ["julho", "Julho", "jul", "JUL"])) as number },
    { mes: 8, valor: parseNumber(pickField(row, ["agosto", "Agosto", "ago", "AGO"])) as number },
    { mes: 9, valor: parseNumber(pickField(row, ["setembro", "Setembro", "set", "SET"])) as number },
    { mes: 10, valor: parseNumber(pickField(row, ["outubro", "Outubro", "out", "OUT"])) as number },
    { mes: 11, valor: parseNumber(pickField(row, ["novembro", "Novembro", "nov", "NOV"])) as number },
    { mes: 12, valor: parseNumber(pickField(row, ["dezembro", "Dezembro", "dez", "DEZ"])) as number },
  ].filter((item) => item.valor !== null && Number.isFinite(item.valor));

  const base: VerbaRecord = {
    company_id: pickField(row, ["company_id"]),
    company_external_id: pickField(row, ["company_external_id", "external_id_empresa", "cnpj_empresa", "cnpj", "empresa_cnpj", "cnpjcpf"]),
    cnpj_empresa: pickField(row, ["cnpj_empresa", "cnpj", "empresa_cnpj", "cnpjcpf"]),
    razao_social: pickField(row, ["razao_social", "empresa", "nome_empresa", "razao", "empresa_nome"]),
    cpf: pickField(row, ["cpf", "cpf_funcionario", "cpf_colaborador", "documento", "nr_cpf", "cpfcnpj", "matricula_cpf"]),
    nome_funcionario: pickField(row, ["nome_funcionario", "funcionario", "nome", "nome_colaborador", "colaborador", "nome_colab"]),
    competencia,
    periodo: competencia,
    tipo_verba: String(tipoVerba || ""),
    id_verba: String(idVerba || ""),
    ano: pickField(row, ["ano", "ano_referencia", "exercicio"]),
    mes: pickField(row, ["mes", "mes_referencia", "num_mes"]),
    cod_evento: codEventoResolved ?? codEventoRaw,
    valor: pickField(row, ["valor", "valor_evento", "valor_bruto", "valor_liquido", "valor_total", "vlr", "valorrubrica"]),
  };

  const baseYear = parseNumber(base.ano);
  if (targetYear && baseYear && Number(baseYear) !== Number(targetYear)) {
    return [];
  }

  if (monthlyValues.length > 0) {
    return monthlyValues
      .filter((entry) => Math.abs(Number(entry.valor || 0)) > 0)
      .filter((entry) => !targetMonth || entry.mes === targetMonth)
      .map((entry) => ({
        ...base,
        mes: entry.mes,
        valor: entry.valor,
        cod_evento: codEventoResolved || 999999,
      }));
  }

  if (targetMonth) {
    const baseMonth = parseNumber(base.mes);
    if (!baseMonth || Number(baseMonth) !== Number(targetMonth)) {
      return [];
    }
  }

  return [base];
}

function mergeUpsertRows(rows: Array<Record<string, unknown>>) {
  const merged = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const key = [
      String(row.company_id || ""),
      String(row.cpf || ""),
      String(row.ano || ""),
      String(row.mes || ""),
      String(row.cod_evento || ""),
    ].join("|");

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row });
      continue;
    }

    const existingValor = parseNumber(existing.valor) ?? 0;
    const incomingValor = parseNumber(row.valor) ?? 0;

    existing.valor = Number(existingValor) + Number(incomingValor);

    if (!existing.nome_funcionario && row.nome_funcionario) {
      existing.nome_funcionario = row.nome_funcionario;
    }

    if (!existing.razao_social && row.razao_social) {
      existing.razao_social = row.razao_social;
    }

    existing.updated_at = new Date().toISOString();
  }

  return [...merged.values()];
}

async function resolveConnectionAndEndpoint(
  supabase: ReturnType<typeof createClient>,
  body: SyncRequest,
): Promise<{ connection: DatalakeConnection; endpointPath: string; queryName: string; queryId: string | null }> {
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
      queryId: null,
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

  const selectedByKeyword = (queries || []).find((query: any) => {
    if (body.query_id) return true;
    const text = `${query.name || ""} ${query.endpoint_path || ""}`.toLowerCase();
    return (
      text.includes("verba") ||
      text.includes("folha") ||
      text.includes("pagamento") ||
      text.includes("evento") ||
      text.includes("holerite") ||
      text.includes("remuneracao") ||
      text.includes("provento") ||
      text.includes("desconto")
    );
  });

  const selectedQuery = selectedByKeyword || (queries || [])[0] || null;

  if (!selectedQuery) {
    const connectionFilter = supabase
      .from("dl_connections")
      .select("id, base_url, headers_json, auth_config_json, is_enabled")
      .eq("is_enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1);

    const { data: fallbackConnections, error: fallbackConnectionError } = await connectionFilter;

    if (fallbackConnectionError) {
      throw new Error(`Falha ao buscar conexão Datalake fallback: ${fallbackConnectionError.message}`);
    }

    const fallbackConnection = (fallbackConnections || [])[0] as DatalakeConnection | undefined;
    if (!fallbackConnection) {
      throw new Error("Nenhuma conexão ativa encontrada em dl_connections. Configure uma conexão ou informe connection_id.");
    }

    console.warn("[sync-verbas] dl_queries vazio; usando fallback da conexão ativa em dl_connections.");

    return {
      connection: fallbackConnection,
      endpointPath: String(body.endpoint_path || "").trim(),
      queryName: "dl_connections_fallback",
      queryId: null,
    };
  }

  if (!selectedByKeyword && !body.query_id) {
    console.warn("[sync-verbas] Nenhuma query com palavras-chave de verbas encontrada; usando fallback da primeira query ativa.");
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
    queryId: String(selectedQuery.id || "") || null,
  };
}

async function ensureQueryIdForRun(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  endpointPath: string,
  existingQueryId?: string | null,
) {
  if (existingQueryId) return existingQueryId;

  const normalizedPath = String(endpointPath || "").trim();
  if (!normalizedPath) return null;

  const { data: existing } = await supabase
    .from("dl_queries")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("endpoint_path", normalizedPath)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: created } = await supabase
    .from("dl_queries")
    .insert({
      connection_id: connectionId,
      name: `SYNC_VERBAS_${normalizedPath}`,
      description: "Query automática criada para logs da sincronização de verbas",
      endpoint_path: normalizedPath,
      method: "GET",
      is_enabled: true,
    })
    .select("id")
    .single();

  return created?.id ? String(created.id) : null;
}

async function writeDlRunLog(
  supabase: ReturnType<typeof createClient>,
  payload: {
    queryId?: string | null;
    status: "success" | "error";
    startedAtIso: string;
    finishedAtIso: string;
    durationMs: number;
    rowsReturned?: number | null;
    errorMessage?: string | null;
    params?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
  },
) {
  if (!payload.queryId) return;

  const { error } = await supabase
    .from("dl_query_runs")
    .insert({
      query_id: payload.queryId,
      status: payload.status,
      params_used_json: payload.params || {},
      started_at: payload.startedAtIso,
      finished_at: payload.finishedAtIso,
      duration_ms: payload.durationMs,
      rows_returned: payload.rowsReturned ?? null,
      error_message: payload.errorMessage || null,
      response_snapshot_json: payload.snapshot || {},
    });

  if (error) {
    console.warn("[sync-verbas] Falha ao registrar dl_query_runs:", error.message);
  }
}

async function loadRowsFromDatalake(
  supabase: ReturnType<typeof createClient>,
  body: SyncRequest,
  jobId?: string | null,
): Promise<{ records: VerbaRecord[]; meta: Record<string, unknown> }> {
  const resolved = await resolveConnectionAndEndpoint(supabase, body);
  const { connection, endpointPath, queryName, queryId } = resolved;

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

  const allPages = body.all_pages === true;
  const maxPages = allPages
    ? 5000
    : Math.max(1, Math.min(500, Number(body.max_pages || 20)));
  const targetMonth = body.target_month ? Number(body.target_month) : null;
  const targetYear = body.target_year ? Number(body.target_year) : null;

  if (targetMonth && (targetMonth < 1 || targetMonth > 12)) {
    throw new Error("target_month inválido; use 1..12");
  }

  // Injeta filtro server-side de ano no DAB (crítico para performance)
  // Sem $filter=ano eq <ANO>: full scan da tabela → >30s → timeout → dados parciais
  // Com filtro: query indexada, retorno em <5s com todos os funcionários do ano
  const queryParamsWithFilter: Record<string, string | number | boolean> = { ...(body.query_params || {}) };
  if (targetYear) {
    const existingFilter = String(queryParamsWithFilter["$filter"] || "").trim();
    const yearFilter = `ano eq ${targetYear}`;
    queryParamsWithFilter["$filter"] = existingFilter
      ? `(${existingFilter}) and (${yearFilter})`
      : yearFilter;
  }
  // Page size generoso: DAB suporta até 100.000 — menos round-trips, mais eficiente
  if (!queryParamsWithFilter["$first"]) {
    queryParamsWithFilter["$first"] = 5000;
  }

  // Injeta filtro tenant_id quando company_external_id (CNPJ) fornecido.
  // O DAB usa tenant_id = razao_social normalizada (UPPERCASE_UNDERSCORE).
  // Reduz volume retornado pelo DAB quando sync é por empresa específica.
  if (body.company_external_id) {
    const cnpjNorm = normalizeCnpj(body.company_external_id);
    const { data: companyRow } = await supabase
      .from("companies")
      .select("name")
      .eq("external_id", cnpjNorm)
      .maybeSingle();
    if (companyRow?.name) {
      const tenantId = toTenantId(companyRow.name);
      const cur = String(queryParamsWithFilter["$filter"] || "").trim();
      const tenantFilter = `tenant_id eq '${tenantId}'`;
      queryParamsWithFilter["$filter"] = cur
        ? `(${cur}) and (${tenantFilter})`
        : tenantFilter;
    }
  }

  const candidates = buildVerbasEndpointCandidates(endpointPath);

  let chosenEndpointPath = "";
  let firstPageBaseUrl = "";
  let firstPageRows: any[] = [];
  let firstPageNextLink: string | null = null;
  let firstEndpointError: string | null = null;

  for (const candidate of candidates) {
    const candidateUrls = buildDatalakeUrls(connection.base_url, candidate, queryParamsWithFilter);

    for (const candidateUrl of candidateUrls) {
      let response: Response;
      let payload: any;
      try {
        ({ response, payload } = await fetchJsonWithRetry(candidateUrl, headers, 3));
      } catch (error) {
        if (!firstEndpointError) {
          firstEndpointError = `Endpoint '${candidate}' (${candidateUrl}) retornou payload inválido: ${String((error as Error)?.message || error)}`;
        }
        continue;
      }

      if (!response.ok) {
        if (response.status === 404 || response.status === 405 || isImplicitPrimaryKeyError(payload)) {
          continue;
        }

        if (!firstEndpointError) {
          firstEndpointError = `Endpoint '${candidate}' (${candidateUrl}) retornou ${response.status}: ${JSON.stringify(payload)}`;
        }
        continue;
      }

      const rows = extractRowsFromDatalakeBody(payload);
      const nextLink = extractNextLink(payload);

      chosenEndpointPath = candidate;
      firstPageBaseUrl = candidateUrl;
      firstPageRows = rows;
      firstPageNextLink = nextLink;

      if (rows.length > 0 || nextLink) {
        break;
      }
    }

    if (chosenEndpointPath && (firstPageRows.length > 0 || firstPageNextLink)) {
      break;
    }
  }

  if (!chosenEndpointPath) {
    throw new Error(
      firstEndpointError ||
      `Nenhum endpoint de verbas válido encontrado. Configure dl_queries ou VERBAS_ENDPOINT_PATH. Candidatos testados: ${candidates.join(", ")}`,
    );
  }

  if (!endpointPath) {
    console.log(`[sync-verbas] Endpoint de verbas detectado automaticamente: ${chosenEndpointPath}`);
  }

  const collected: VerbaRecord[] = [];
  let pagesFetched = 0;
  collected.push(...firstPageRows.flatMap((row) => mapDatalakeRowToVerbaRecords(row, { targetMonth, targetYear })));
  pagesFetched += 1;

  let currentUrl = firstPageNextLink ? new URL(firstPageNextLink, firstPageBaseUrl).toString() : "";

  for (let page = 2; currentUrl; page++) {
    if (!allPages && page > maxPages) {
      break;
    }

    if (allPages && page > 5000) {
      throw new Error("Proteção de paginação acionada: all_pages excedeu 5000 páginas.");
    }

    const { response, payload } = await fetchJsonWithRetry(currentUrl, headers, 3);

    if (!response.ok) {
      throw new Error(`Datalake retornou ${response.status} na página ${page}: ${JSON.stringify(payload)}`);
    }

    const rows = extractRowsFromDatalakeBody(payload);
    collected.push(...rows.flatMap((row) => mapDatalakeRowToVerbaRecords(row, { targetMonth, targetYear })));
    pagesFetched += 1;

    // Atualiza progresso do job a cada 10 páginas (fire-and-forget)
    if (jobId && page % 10 === 0) {
      supabase.from("verbas_sync_jobs").update({
        pages_fetched: pagesFetched,
        records_received: collected.length,
      }).eq("id", jobId).then(() => {/* noop */}).catch(() => {/* noop */});
    }

    const nextLink = extractNextLink(payload);
    currentUrl = nextLink ? new URL(nextLink, currentUrl).toString() : "";
  }

  const effectiveQueryId = await ensureQueryIdForRun(supabase, connection.id, chosenEndpointPath, queryId);

  return {
    records: collected,
    meta: {
      query_name: queryName,
      query_id: effectiveQueryId,
      connection_id: connection.id,
      endpoint_path: chosenEndpointPath,
      target_month: targetMonth,
      target_year: targetYear,
      all_pages: allPages,
      pages_fetched: pagesFetched,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let jobId: string | null = null;

  try {
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("SYNC_API_KEY");
    const authorization = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const bearerToken = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const hasValidApiKey = Boolean(apiKey && expectedApiKey && apiKey === expectedApiKey);
    const hasValidServiceRoleBearer = Boolean(bearerToken && serviceRoleKey && bearerToken === serviceRoleKey);

    if (!hasValidApiKey && !hasValidServiceRoleBearer) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKeyForClient = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKeyForClient);

    const body = (await req.json().catch(() => ({}))) as SyncRequest;
    const sourceSystem = body.source_system || "gestao_ativos";
    const startedAtIso = new Date(startedAt).toISOString();
    const directRecords = Array.isArray(body.records) ? body.records : (Array.isArray(body.events) ? body.events : []);
    jobId = body.job_id ?? null;

    // Marca job como 'running' assim que a execução começa
    if (jobId) {
      await supabase.from("verbas_sync_jobs").update({
        status: "running",
        started_at: startedAtIso,
      }).eq("id", jobId);
    }

    let records = directRecords;
    let datalakeMeta: Record<string, unknown> | undefined;

    if (!records.length && body.load_from_datalake !== false) {
      const loaded = await loadRowsFromDatalake(supabase, body, jobId);
      records = loaded.records;
      datalakeMeta = loaded.meta;
    }

    if (!records.length) {
      await writeDlRunLog(supabase, {
        queryId: String(datalakeMeta?.query_id || "") || null,
        status: "success",
        startedAtIso,
        finishedAtIso: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        rowsReturned: 0,
        params: {
          source_system: sourceSystem,
          target_month: body.target_month || null,
          target_year: body.target_year || null,
          max_pages: body.max_pages || null,
        },
        snapshot: {
          no_data: true,
          message: "Nenhum dado encontrado para os filtros informados (mês/ano).",
          datalake: datalakeMeta,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          source_system: sourceSystem,
          received: 0,
          processed: 0,
          failed: 0,
          upserted: 0,
          deduplicated: 0,
          duration_ms: Date.now() - startedAt,
          datalake: datalakeMeta,
          no_data: true,
          message: "Nenhum dado encontrado para os filtros informados (mês/ano).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let companies: any[] = [];
    {
      const firstAttempt = await supabase
        .from("companies")
        .select("id, external_id, name, razao_social");

      if (!firstAttempt.error) {
        companies = firstAttempt.data || [];
      } else {
        const msg = String(firstAttempt.error.message || "");
        const missingRazao = msg.toLowerCase().includes("column") && msg.toLowerCase().includes("razao_social");
        if (!missingRazao) {
          throw new Error(`Failed to load companies: ${firstAttempt.error.message}`);
        }

        // Backward compatible: some remote DBs don't have companies.razao_social yet.
        const fallbackAttempt = await supabase
          .from("companies")
          .select("id, external_id, name");

        if (fallbackAttempt.error) {
          throw new Error(`Failed to load companies: ${fallbackAttempt.error.message}`);
        }

        companies = fallbackAttempt.data || [];
      }
    }

    const companyByExternalId = new Map<string, { id: string; name: string | null }>();
    const companyById = new Map<string, { id: string; name: string | null }>();
    const companyByName = new Map<string, { id: string; name: string | null }>();
    for (const company of companies || []) {
      companyById.set(company.id, { id: company.id, name: company.name || null });
      const normalized = normalizeCnpj(company.external_id);
      if (normalized) {
        companyByExternalId.set(normalized, { id: company.id, name: company.name || null });
      }

      const normalizedName = normalizeCompanyNameKey(company.name || null);
      if (normalizedName) companyByName.set(normalizedName, { id: company.id, name: company.name || null });

      const normalizedRazao = normalizeCompanyNameKey((company as any).razao_social || null);
      if (normalizedRazao) companyByName.set(normalizedRazao, { id: company.id, name: company.name || null });
    }

    const companyNameEntries = [...companyByName.entries()];

    const scopeYear = body.target_year ? Number(body.target_year) : null;
    const scopeMonth = body.target_month ? Number(body.target_month) : null;
    const canUseEmployeeSnapshots = Boolean(scopeYear && scopeMonth);
    const scopeAsOfIso = canUseEmployeeSnapshots ? getCompetenciaAsOfIso(scopeYear!, scopeMonth!) : null;

    const cpfsInPayload = Array.from(
      new Set(
        records
          .map((record) => normalizeCpf(record.cpf))
          .filter(Boolean) as string[],
      ),
    );

    const employeesByCpf = new Map<
      string,
      Array<{
        company_id: string;
        full_name: string | null;
        is_active: boolean | null;
        is_disabled: boolean | null;
        department: string | null;
        position: string | null;
        unidade: string | null;
        accounting_group: string | null;
        contract_company_id: string | null;
        accounting_company_id: string | null;
      }>
    >();

    if (cpfsInPayload.length > 0) {
      const rowsToIndex: any[] = [];

      let snapshotsAvailable = canUseEmployeeSnapshots && Boolean(scopeAsOfIso);

      if (snapshotsAvailable) {
        for (const cpfChunk of chunkArray(cpfsInPayload, 500)) {
          // Try with is_disabled first; fall back if the column isn't present in older DBs.
          let snapshotRows: any[] | null = null;
          let snapshotError: any = null;

          {
            const attempt = await supabase
              .from("external_employee_snapshots")
              .select(
                "company_id, cpf, full_name, is_active, is_disabled, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
              )
              .in("cpf", cpfChunk)
              .not("cpf", "is", null)
              .neq("cpf", "")
              .not("company_id", "is", null)
              .lte("valid_from", scopeAsOfIso)
              .or(`valid_to.is.null,valid_to.gt.${scopeAsOfIso}`);

            snapshotRows = attempt.data || null;
            snapshotError = attempt.error || null;
          }

          if (snapshotError && isMissingColumnError(snapshotError, "is_disabled")) {
            const fallback = await supabase
              .from("external_employee_snapshots")
              .select(
                "company_id, cpf, full_name, is_active, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
              )
              .in("cpf", cpfChunk)
              .not("cpf", "is", null)
              .neq("cpf", "")
              .not("company_id", "is", null)
              .lte("valid_from", scopeAsOfIso)
              .or(`valid_to.is.null,valid_to.gt.${scopeAsOfIso}`);

            snapshotRows = fallback.data || null;
            snapshotError = fallback.error || null;
          }

          if (snapshotError) {
            // Snapshots schema may be outdated (missing columns) — fall back to external_employees.
            console.warn("[sync-verbas] external_employee_snapshots query failed; falling back to external_employees.", {
              message: String(snapshotError?.message || snapshotError),
            });
            snapshotsAvailable = false;
            break;
          }

          rowsToIndex.push(...(snapshotRows || []));
        }

        // Fallback: if snapshots are missing for some CPFs (e.g., backfill not applied yet),
        // load from external_employees so we can still resolve company_id by CPF.
        if (snapshotsAvailable) {
          const snapshotCpfSet = new Set(
            (rowsToIndex || [])
              .map((row) => normalizeCpf(row?.cpf))
              .filter(Boolean) as string[],
          );
          const missingCpfs = cpfsInPayload.filter((cpf) => !snapshotCpfSet.has(cpf));

          if (missingCpfs.length > 0) {
            for (const cpfChunk of chunkArray(missingCpfs, 500)) {
              const attempt = await supabase
                .from("external_employees")
                .select(
                  "company_id, cpf, full_name, is_active, is_disabled, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
                )
                .in("cpf", cpfChunk)
                .not("cpf", "is", null)
                .neq("cpf", "")
                .not("company_id", "is", null);

              if (attempt.error && isMissingColumnError(attempt.error, "is_disabled")) {
                const fallback = await supabase
                  .from("external_employees")
                  .select(
                    "company_id, cpf, full_name, is_active, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
                  )
                  .in("cpf", cpfChunk)
                  .not("cpf", "is", null)
                  .neq("cpf", "")
                  .not("company_id", "is", null);

                if (fallback.error) {
                  throw new Error(`Failed to load external_employees fallback: ${fallback.error.message}`);
                }

                rowsToIndex.push(...(fallback.data || []));
                continue;
              }

              if (attempt.error) {
                throw new Error(`Failed to load external_employees fallback: ${attempt.error.message}`);
              }

              rowsToIndex.push(...(attempt.data || []));
            }
          }
        }
      } else {
        for (const cpfChunk of chunkArray(cpfsInPayload, 500)) {
          const attempt = await supabase
            .from("external_employees")
            .select(
              "company_id, cpf, full_name, is_active, is_disabled, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
            )
            .in("cpf", cpfChunk)
            .not("cpf", "is", null)
            .neq("cpf", "")
            .not("company_id", "is", null);

          if (attempt.error && isMissingColumnError(attempt.error, "is_disabled")) {
            const fallback = await supabase
              .from("external_employees")
              .select(
                "company_id, cpf, full_name, is_active, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
              )
              .in("cpf", cpfChunk)
              .not("cpf", "is", null)
              .neq("cpf", "")
              .not("company_id", "is", null);

            if (fallback.error) {
              throw new Error(`Failed to load external_employees: ${fallback.error.message}`);
            }

            rowsToIndex.push(...(fallback.data || []));
            continue;
          }

          if (attempt.error) {
            throw new Error(`Failed to load external_employees: ${attempt.error.message}`);
          }

          rowsToIndex.push(...(attempt.data || []));
        }
      }

      // If snapshots are not usable, rebuild the index from external_employees only.
      if (canUseEmployeeSnapshots && !snapshotsAvailable) {
        rowsToIndex.length = 0;
        for (const cpfChunk of chunkArray(cpfsInPayload, 500)) {
          const attempt = await supabase
            .from("external_employees")
            .select(
              "company_id, cpf, full_name, is_active, is_disabled, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
            )
            .in("cpf", cpfChunk)
            .not("cpf", "is", null)
            .neq("cpf", "")
            .not("company_id", "is", null);

          if (attempt.error && isMissingColumnError(attempt.error, "is_disabled")) {
            const fallback = await supabase
              .from("external_employees")
              .select(
                "company_id, cpf, full_name, is_active, department, position, unidade, accounting_group, contract_company_id, accounting_company_id",
              )
              .in("cpf", cpfChunk)
              .not("cpf", "is", null)
              .neq("cpf", "")
              .not("company_id", "is", null);

            if (fallback.error) {
              throw new Error(`Failed to load external_employees: ${fallback.error.message}`);
            }

            rowsToIndex.push(...(fallback.data || []));
            continue;
          }

          if (attempt.error) {
            throw new Error(`Failed to load external_employees: ${attempt.error.message}`);
          }

          rowsToIndex.push(...(attempt.data || []));
        }
      }

      for (const employee of rowsToIndex) {
        const normalizedCpf = normalizeCpf(employee.cpf);
        if (!normalizedCpf || !employee.company_id) continue;

        const list = employeesByCpf.get(normalizedCpf) || [];
        list.push({
          company_id: employee.company_id,
          full_name: employee.full_name || null,
          is_active: employee.is_active ?? null,
          is_disabled: employee.is_disabled ?? null,
          department: employee.department || null,
          position: employee.position || null,
          unidade: employee.unidade || null,
          accounting_group: employee.accounting_group || null,
          contract_company_id: employee.contract_company_id || null,
          accounting_company_id: employee.accounting_company_id || null,
        });
        employeesByCpf.set(normalizedCpf, list);
      }
    }

    const fallbackExternalId = normalizeCnpj(body.company_external_id || null);
    const fallbackCompany = fallbackExternalId ? companyByExternalId.get(fallbackExternalId) : null;

    let processed = 0;
    let failed = 0;
    let ignored = 0;
    let semEmpresa = 0;
    const previewOnly = body.preview_only === true;
    const distinctCpfsInSource = new Set<string>();
    const semEmpresaRecords: Array<{ cpf: string; nome: string }> = [];
    const errors: Array<Record<string, unknown>> = [];
    const reasonCounts = new Map<string, number>();
    const upsertRows: Array<Record<string, unknown>> = [];

    for (let index = 0; index < records.length; index++) {
      const item = records[index];

      try {
        const cpf = normalizeCpf(item.cpf);
        const parsedCompetencia = parseAnoMesFromText(item.competencia || item.periodo);
        const ano = parseNumber(item.ano) ?? parsedCompetencia.ano;
        const mes = parseNumber(item.mes) ?? parsedCompetencia.mes;
        const codEvento = parseCodEvento(item.cod_evento);
        const valor = parseNumber(item.valor) ?? 0;

        if (!cpf) throw new Error("CPF inválido");
        if (!ano || ano < 2000) throw new Error("Ano inválido");
        if (!mes || mes < 1 || mes > 12) throw new Error("Mês inválido");
        if (!codEvento) throw new Error("cod_evento inválido");

        const normalizedExternalId = normalizeCnpj(item.company_external_id || item.cnpj_empresa || null);
        const mappedCompany = normalizedExternalId
          ? companyByExternalId.get(normalizedExternalId)
          : null;

        const normalizedCompanyNameFromRow = normalizeCompanyNameKey(item.razao_social || null);
        const mappedCompanyByName = normalizedCompanyNameFromRow
          ? companyByName.get(normalizedCompanyNameFromRow)
          : null;

        let mappedCompanyByNameFuzzy: { id: string; name: string | null } | null = null;
        if (!mappedCompanyByName && normalizedCompanyNameFromRow) {
          const fuzzyCandidates = companyNameEntries
            .filter(([nameKey]) =>
              nameKey.includes(normalizedCompanyNameFromRow) ||
              normalizedCompanyNameFromRow.includes(nameKey),
            )
            .map(([, company]) => company);

          if (fuzzyCandidates.length === 1) {
            mappedCompanyByNameFuzzy = fuzzyCandidates[0];
          }
        }

        // Track distinct CPFs seen in the source (DAB)
        distinctCpfsInSource.add(cpf);

        // ── Nova arquitetura: staging-first ──────────────────────────────────
        // Não tentamos resolver company_id aqui. Todos os registros válidos
        // (CPF + ano + mes + cod_evento) vão para payroll_verba_staging.
        // O JOIN com external_employees acontece depois via apply_payroll_staging().
        //
        // Para preview: usamos employeesByCpf apenas para estatísticas.
        if (previewOnly) {
          const employeesForCpf = employeesByCpf.get(cpf) || [];
          if (employeesForCpf.length === 0) {
            ignored++;
          } else {
            const hasCompany = employeesForCpf.some((e) => e.company_id);
            if (!hasCompany) {
              semEmpresa++;
              semEmpresaRecords.push({
                cpf,
                nome: employeesForCpf[0]?.full_name || (item.nome_funcionario as string) || cpf,
              });
            } else {
              processed++;
            }
          }
        } else {
          // Sync real: empurra para staging sem company_id
          upsertRows.push({
            cpf,
            nome_funcionario: (item.nome_funcionario || item.nome || "NOME_NAO_INFORMADO").trim(),
            ano: Number(ano),
            mes: Number(mes),
            cod_evento: Number(codEvento),
            valor: Number(valor),
          });
          processed++;
        }
      } catch (error) {
        failed++;
        const reason = String(error);
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        errors.push({ index, item, error: reason });
      }
    }

    const dedupedUpsertRows = mergeUpsertRows(upsertRows);
    const replaceScope = body.replace_scope !== false;

    const rowsToPersist = dedupedUpsertRows.filter((row) => {
      if (scopeYear && Number(row.ano) !== scopeYear) return false;
      if (scopeMonth && Number(row.mes) !== scopeMonth) return false;
      return true;
    });

    // ── Agregar long format → staging (1 linha por cpf × tipo_verba × ano) ──
    // Sem company_id — a associação com empresa é feita pelo DB via apply_payroll_staging()
    const stagingMap = new Map<string, Record<string, any>>();

    for (const rec of rowsToPersist) {
      const tipoVerba =
        (rec.tipo_verba as string) ||
        COD_EVENTO_TO_TIPO[rec.cod_evento as number] ||
        "OUTROS";
      if (tipoVerba === "OUTROS") continue;

      const cpfNorm = normalizeDigits(rec.cpf as string);
      const key = `${cpfNorm}|${tipoVerba}|${rec.ano}`;

      if (!stagingMap.has(key)) {
        stagingMap.set(key, {
          cpf: cpfNorm,
          nome_funcionario: String(rec.nome_funcionario || "NOME_NAO_INFORMADO"),
          tipo_verba: tipoVerba,
          ano: rec.ano,
          janeiro: 0, fevereiro: 0, marco: 0, abril: 0,
          maio: 0, junho: 0, julho: 0, agosto: 0,
          setembro: 0, outubro: 0, novembro: 0, dezembro: 0,
          synced_at: new Date().toISOString(),
        });
      }

      const stg = stagingMap.get(key)!;
      const monthField = MONTH_NUMBER_TO_FIELD[rec.mes as number];
      if (monthField) stg[monthField] += Number(rec.valor) || 0;
    }

    let stagingRows = [...stagingMap.values()];

    // ── Preview mode: retorna stats sem escrever no banco ─────────────────────
    if (previewOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          preview_only: true,
          source_system: sourceSystem,
          received: records.length,
          distinct_cpfs_in_source: distinctCpfsInSource.size,
          cpfs_matched: processed,
          cpfs_sem_empresa: semEmpresa,
          sem_empresa_records: semEmpresaRecords.slice(0, 500),
          cpfs_not_found: ignored,
          failed,
          datalake: datalakeMeta,
          failure_reasons: [...reasonCounts.entries()]
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Replace scope: limpar staging (e pivot) antes de regravar ────────────
    if (replaceScope && scopeYear && stagingRows.length > 0) {
      if (!scopeMonth) {
        // Sync de ano completo: limpar staging e pivot para o ano antes de reescrever
        const { error: stgDeleteError } = await supabase
          .from("payroll_verba_staging")
          .delete()
          .eq("ano", scopeYear);
        if (stgDeleteError) {
          throw new Error(`Failed to clear staging rows: ${stgDeleteError.message}`);
        }

        const { error: pivotDeleteError } = await supabase
          .from("payroll_verba_pivot")
          .delete()
          .eq("ano", scopeYear);
        if (pivotDeleteError) {
          throw new Error(`Failed to clear pivot rows: ${pivotDeleteError.message}`);
        }
      } else {
        // Sync mensal: preservar outros meses no staging, atualizar só o mês alvo
        const cpfs = [...new Set(stagingRows.map((r) => String(r.cpf || "")).filter(Boolean))];
        const { data: existingStaging } = await supabase
          .from("payroll_verba_staging")
          .select("cpf, tipo_verba, ano, " + MONTH_FIELDS.join(", "))
          .in("cpf", cpfs)
          .eq("ano", scopeYear);

        if (existingStaging && existingStaging.length > 0) {
          const existingMap = new Map<string, Record<string, any>>(
            existingStaging.map((r: any) => [
              `${normalizeDigits(r.cpf)}|${r.tipo_verba}|${r.ano}`,
              r,
            ]),
          );

          const targetField = MONTH_NUMBER_TO_FIELD[scopeMonth];
          stagingRows = stagingRows.map((row) => {
            const eKey = `${normalizeDigits(row.cpf)}|${row.tipo_verba}|${row.ano}`;
            const existing = existingMap.get(eKey);
            if (!existing) return row;
            // Preservar todos os meses do staging existente; sobrescrever apenas o mês alvo
            const merged = { ...row };
            for (const m of MONTH_FIELDS) {
              if (m !== targetField) {
                merged[m] = existing[m] ?? 0;
              }
            }
            return merged;
          });
        }
      }
    }

    // ── Upsert staging em chunks de 500 ───────────────────────────────────────
    if (stagingRows.length > 0) {
      for (const chunk of chunkArray(stagingRows, 500)) {
        const { error: upsertError } = await supabase
          .from("payroll_verba_staging")
          .upsert(chunk, {
            onConflict: "cpf,tipo_verba,ano",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          throw new Error(`Failed to upsert staging rows: ${upsertError.message}`);
        }
      }
    }

    // ── Aplicar staging → pivot via JOIN com external_employees ───────────────
    let applyResult: { inserted_or_updated?: number; cpfs_sem_empresa?: number } = {};
    if (stagingRows.length > 0) {
      const { data: applyData, error: applyError } = await supabase
        .rpc("apply_payroll_staging", { p_ano: scopeYear ?? null });

      if (applyError) {
        console.warn("[sync-verbas] apply_payroll_staging error:", applyError.message);
      } else {
        applyResult = applyData as typeof applyResult || {};
      }
    }

    // Atualiza job com métricas finais
    if (jobId) {
      await supabase.from("verbas_sync_jobs").update({
        status: "done",
        pages_fetched: Number(datalakeMeta?.pages_fetched ?? 0),
        records_received: records.length,
        records_upserted: applyResult.inserted_or_updated ?? stagingRows.length,
        records_failed: failed,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    const failureReasons = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const summarizedFailure = failureReasons
      .slice(0, 3)
      .map((item) => `${item.reason} (${item.count})`)
      .join(" | ");

    await writeDlRunLog(supabase, {
      queryId: String(datalakeMeta?.query_id || "") || null,
      status: failed > 0 ? "error" : "success",
      startedAtIso,
      finishedAtIso: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      rowsReturned: stagingRows.length,
      errorMessage: failed > 0 ? `Falhas: ${failed}. ${summarizedFailure}` : null,
      params: {
        source_system: sourceSystem,
        target_month: body.target_month || null,
        target_year: body.target_year || null,
        max_pages: body.max_pages || null,
        replace_scope: replaceScope,
      },
      snapshot: {
        received: records.length,
        processed,
        failed,
        ignored,
        staging_rows: stagingRows.length,
        pivot_rows: applyResult.inserted_or_updated ?? 0,
        cpfs_sem_empresa: applyResult.cpfs_sem_empresa ?? 0,
        replace_scope: replaceScope,
        scope_year: scopeYear,
        scope_month: scopeMonth,
        failure_reasons: failureReasons,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        source_system: sourceSystem,
        received: records.length,
        distinct_cpfs_in_source: distinctCpfsInSource.size,
        staging_rows: stagingRows.length,
        pivot_rows: applyResult.inserted_or_updated ?? 0,
        cpfs_sem_empresa: applyResult.cpfs_sem_empresa ?? 0,
        processed,
        failed,
        ignored,
        duration_ms: Date.now() - startedAt,
        datalake: datalakeMeta,
        failure_reasons: failureReasons,
        errors: errors.length ? errors.slice(0, 100) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKeyForClient = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKeyForClient);
      const startedAtIso = new Date(startedAt).toISOString();

      // Tenta marcar o job como erro
      if (jobId) {
        try {
          await supabase.from("verbas_sync_jobs").update({
            status: "error",
            error_message: String((error as Error)?.message || error).slice(0, 500),
            completed_at: new Date().toISOString(),
          }).eq("id", jobId);
        } catch (_jobErr) {
          // noop — não bloquear o log principal
        }
      }

      await writeDlRunLog(supabase, {
        queryId: null,
        status: "error",
        startedAtIso,
        finishedAtIso: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        rowsReturned: 0,
        errorMessage: String(error),
        params: {},
        snapshot: { stage: "catch" },
      });
    } catch (_logError) {
      // noop
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
