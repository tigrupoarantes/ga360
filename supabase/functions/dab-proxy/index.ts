import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PATHS = new Set([
  // GA360 - RH / Gestão de Pessoas
  "funcionarios",
  "self",
  // Cockpit GA - Comercial / Analytics
  "health",
  "companies",
  "venda_prod",
  "sales_daily",
  "sales_by_sku",
  "coverage_city",
  "stock_position",
  "produtos",
  "stock_lots",
  "sales_product_detail",
]);

interface DabProxyRequest {
  path?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  nextLink?: string;
  connectionId?: string;
  allPages?: boolean;
  maxPages?: number;
  logSync?: boolean;
  syncType?: string;
  companyId?: string | null;
}

interface ApiConnectionConfig {
  baseUrl: string;
  apiKey?: string;
  authHeader?: string;
  authHeaderName?: string;
  headersJson?: Record<string, string>;
}

function sanitizeBaseUrl(rawBaseUrl: string): string {
  let normalized = (rawBaseUrl || "").trim();
  if (!normalized) return normalized;

  normalized = normalized.replace(/\/+$/, "");

  normalized = normalized
    .replace(/\/v1\/v1(\/|$)/i, "/v1$1")
    .replace(/\/api\/api(\/|$)/i, "/api$1")
    .replace(/\/v1\/api(\/|$)/i, "/v1$1");

  normalized = normalized.replace(/\/(health|funcionarios)$/i, "");

  return normalized;
}

function normalizeNextLink(nextLink: string, baseUrl: string): string {
  const trimmed = (nextLink || "").trim();
  if (!trimmed) return trimmed;

  const safeBase = sanitizeBaseUrl(baseUrl);
  const base = safeBase.endsWith("/") ? safeBase : `${safeBase}/`;
  const baseUrlObject = new URL(base);
  const basePath = baseUrlObject.pathname.replace(/\/+$/, "").toLowerCase();
  const shouldUseV1 = basePath.endsWith("/v1");

  if (/^https?:\/\//i.test(trimmed)) {
    const absolute = new URL(trimmed);
    if (shouldUseV1 && absolute.pathname.toLowerCase().startsWith("/api/")) {
      absolute.pathname = absolute.pathname.replace(/^\/api\//i, "/v1/");
    }
    return absolute.toString();
  }

  // Some APIs return nextLink as an absolute path (e.g. "/funcionarios?..."),
  // but the base URL may be rooted under "/api" or "/v1". In those cases,
  // preserve the base prefix so pagination doesn't jump to the wrong path.
  if (trimmed.startsWith("/")) {
    const lower = trimmed.toLowerCase();

    if (shouldUseV1 && !lower.startsWith("/v1/") && !lower.startsWith("/api/")) {
      return new URL(`/v1${trimmed}`, baseUrlObject.origin).toString();
    }

    if (basePath.endsWith("/api") && !lower.startsWith("/api/") && !lower.startsWith("/v1/")) {
      return new URL(`/api${trimmed}`, baseUrlObject.origin).toString();
    }

    return new URL(trimmed, baseUrlObject.origin).toString();
  }

  if (shouldUseV1 && /^\/?api\//i.test(trimmed)) {
    const rewritten = trimmed.replace(/^\/?api\//i, "v1/");
    return new URL(rewritten, base).toString();
  }

  return new URL(trimmed, base).toString();
}

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+/, "")
    .replace(/^api\//i, "")
    .replace(/^v1\//i, "")
    .split("?")[0]
    .toLowerCase();
}

function sanitizeError(error: unknown) {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

function safeParseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
  if (!text) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: sanitizeError(error) };
  }
}

function applyQueryParams(url: URL, query?: Record<string, string | number | boolean | null | undefined>) {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
}

function extractNextLinkFromHeaders(headers: Headers): string | undefined {
  const directCandidates = [
    headers.get("x-next-link"),
    headers.get("x-next-page"),
    headers.get("next"),
    headers.get("x-pagination-next"),
    headers.get("odata-nextlink"),
  ];

  for (const candidate of directCandidates) {
    if (candidate && candidate.trim()) return candidate.trim();
  }

  const linkHeader = headers.get("link");
  if (linkHeader) {
    const relNextMatch = linkHeader.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (relNextMatch?.[1]) {
      return relNextMatch[1].trim();
    }

    const firstUrlMatch = linkHeader.match(/<([^>]+)>/);
    if (firstUrlMatch?.[1]) {
      return firstUrlMatch[1].trim();
    }
  }

  const structuredCandidates = [
    headers.get("x-pagination"),
    headers.get("x-paging"),
    headers.get("pagination"),
  ];

  for (const candidate of structuredCandidates) {
    if (!candidate || !candidate.trim()) continue;
    try {
      const parsed = JSON.parse(candidate);
      const nextFromJson = extractNextLinkFromBody(parsed);
      if (nextFromJson) return nextFromJson;
    } catch {
      // ignore
    }
  }

  return undefined;
}

function extractRowsFromBody(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const candidates = [obj.value, obj.data, obj.items, obj.results, obj.rows, obj.funcionarios, obj.employees];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
      }
    }
  }

  return [];
}

function extractNextLinkFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;

  const obj = body as Record<string, unknown>;
  const candidates = [
    obj.nextLink,
    obj.next,
    obj.next_link,
    obj.nextlink,
    obj["@odata.nextLink"],
    obj["@odata.nextlink"],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  // Deep search: some APIs return pagination objects like { pagination: { next: "..." } }
  // or { links: { next: "..." } }.
  const root = body as Record<string, unknown>;
  const queue: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 0 }];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { node, depth } = current;
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (depth > 6) continue;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === "string") {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("next") && value.trim()) {
          // Accept absolute URLs, relative URLs, or any string that looks like a paginator query
          if (/^https?:\/\//i.test(value) || value.startsWith("/") || value.includes("skip") || value.includes("page")) {
            return value.trim();
          }
        }
      }

      if (value && typeof value === "object") {
        queue.push({ node: value, depth: depth + 1 });
      }
    }
  }

  return undefined;
}

function employeeRowKey(row: Record<string, unknown>): string {
  const idFuncionario = row["id_funcionario"];
  if (typeof idFuncionario === "string" && idFuncionario.trim()) return `id_funcionario:${idFuncionario}`;
  const id = row["id"];
  if (typeof id === "string" && id.trim()) return `id:${id}`;
  const cpf = row["cpf"];
  if (typeof cpf === "string" && cpf.trim()) return `cpf:${cpf}`;
  try {
    return `json:${JSON.stringify(row)}`;
  } catch {
    return `obj:${String(row)}`;
  }
}

function buildPagedQueryCandidates(pageSize: number, pageIndex: number): Array<Record<string, string | number>> {
  const offset = Math.max(0, (pageIndex - 1) * pageSize);
  return [
    { $top: pageSize, $skip: offset },
    { top: pageSize, skip: offset },
    { $first: pageSize, $skip: offset },
    { first: pageSize, skip: offset },
    { limit: pageSize, offset },
    { take: pageSize, skip: offset },
    // ABP / common backends
    { maxResultCount: pageSize, skipCount: offset },
    // page-based
    { page: pageIndex, pageSize },
    { pageNumber: pageIndex, pageSize },
    { page: pageIndex, per_page: pageSize },
    { page: pageIndex, page_size: pageSize },
    // Portuguese variants
    { pagina: pageIndex, pageSize },
    { pagina: pageIndex, tamanhoPagina: pageSize },
    // start/count variants
    { start: offset, count: pageSize },
  ];
}

function buildCandidateUrls(baseUrl: string, payload: DabProxyRequest): string[] {
  const sanitizedBaseUrl = sanitizeBaseUrl(baseUrl);
  const base = sanitizedBaseUrl.endsWith("/") ? sanitizedBaseUrl : `${sanitizedBaseUrl}/`;

  if (payload.nextLink) {
    return [normalizeNextLink(payload.nextLink, sanitizedBaseUrl)];
  }

  const normalized = normalizePath(payload.path || "");
  if (!ALLOWED_PATHS.has(normalized)) {
    throw new Response(
      JSON.stringify({ error: "path_not_allowed", allowedPaths: [...ALLOWED_PATHS] }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const baseUrlObject = new URL(base);
  const normalizedPathname = baseUrlObject.pathname.replace(/\/+$/, "").toLowerCase();

  if (normalized === "self") {
    const candidates = new Set<string>();

    const directUrl = new URL(baseUrlObject.toString());
    applyQueryParams(directUrl, payload.query);
    candidates.add(directUrl.toString());

    const directHealthUrl = new URL(baseUrlObject.toString());
    directHealthUrl.pathname = `${directHealthUrl.pathname.replace(/\/+$/, "")}/health`;
    applyQueryParams(directHealthUrl, payload.query);
    candidates.add(directHealthUrl.toString());

    const parentPath = baseUrlObject.pathname.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";
    const parentUrl = new URL(baseUrlObject.toString());
    parentUrl.pathname = parentPath;
    applyQueryParams(parentUrl, payload.query);
    candidates.add(parentUrl.toString());

    const parentHealthUrl = new URL(baseUrlObject.toString());
    parentHealthUrl.pathname = `${parentPath.replace(/\/+$/, "")}/health`;
    applyQueryParams(parentHealthUrl, payload.query);
    candidates.add(parentHealthUrl.toString());

    return [...candidates];
  }

  if (normalizedPathname.endsWith("/funcionarios")) {
    applyQueryParams(baseUrlObject, payload.query);
    return [baseUrlObject.toString()];
  }

  const endpoints: string[] = [];

  if (normalizedPathname.endsWith("/api") || normalizedPathname.endsWith("/v1/api")) {
    endpoints.push(normalized);
  } else if (normalizedPathname.endsWith("/v1")) {
    endpoints.push(normalized);
    endpoints.push(`api/${normalized}`);
  } else {
    endpoints.push(normalized);
    endpoints.push(`api/${normalized}`);
    endpoints.push(`v1/api/${normalized}`);
    endpoints.push(`v1/${normalized}`);
  }

  const uniqueUrls = new Set<string>();

  for (const endpoint of endpoints) {
    const url = new URL(endpoint, base);
    applyQueryParams(url, payload.query);
    uniqueUrls.add(url.toString());
  }

  return [...uniqueUrls];
}

function resolveApiKeyFromRecord(record: Record<string, any>): string | undefined {
  const headersJson = record.headers_json || {};
  const authConfigJson = record.auth_config_json || {};
  const customHeaderName = authConfigJson.authHeaderName;

  return (
    record.api_key ||
    (customHeaderName ? headersJson[customHeaderName] : undefined) ||
    headersJson["X-API-Key"] ||
    headersJson["x-api-key"] ||
    authConfigJson.apiKey ||
    authConfigJson.api_key ||
    undefined
  );
}

function resolveAuthHeaderFromRecord(record: Record<string, any>): string | undefined {
  const authConfigJson = record.auth_config_json || {};
  if (authConfigJson.bearerToken) return `Bearer ${authConfigJson.bearerToken}`;
  if (authConfigJson.token) return `Bearer ${authConfigJson.token}`;
  return undefined;
}

function resolveAuthHeaderNameFromRecord(record: Record<string, any>): string | undefined {
  const authConfigJson = record.auth_config_json || {};
  return authConfigJson.authHeaderName || undefined;
}

function resolveHeadersFromRecord(record: Record<string, any>): Record<string, string> {
  const headersJson = record.headers_json || {};
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(headersJson)) {
    if (!key || value === undefined || value === null) continue;
    headers[key] = String(value);
  }

  return headers;
}

async function getConnectionConfig(
  supabaseService: ReturnType<typeof createClient>,
  connectionId?: string,
): Promise<ApiConnectionConfig> {
  if (connectionId) {
    const { data: selectedConnection, error: selectedConnectionError } = await supabaseService
      .from("dl_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("is_enabled", true)
      .maybeSingle();

    if (selectedConnectionError || !selectedConnection) {
      throw new Error("Selected connection not found or disabled");
    }

    return {
      baseUrl: selectedConnection.base_url,
      apiKey: resolveApiKeyFromRecord(selectedConnection),
      authHeader: resolveAuthHeaderFromRecord(selectedConnection),
      authHeaderName: resolveAuthHeaderNameFromRecord(selectedConnection),
      headersJson: resolveHeadersFromRecord(selectedConnection),
    };
  }

  const { data: apiConnection, error: apiConnectionError } = await supabaseService
    .from("api_connections")
    .select("*")
    .eq("is_enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!apiConnectionError && apiConnection) {
    return {
      baseUrl: apiConnection.base_url,
      apiKey: resolveApiKeyFromRecord(apiConnection),
      authHeader: resolveAuthHeaderFromRecord(apiConnection),
      authHeaderName: resolveAuthHeaderNameFromRecord(apiConnection),
      headersJson: resolveHeadersFromRecord(apiConnection),
    };
  }

  const { data: dlConnection, error: dlConnectionError } = await supabaseService
    .from("dl_connections")
    .select("*")
    .eq("is_enabled", true)
    .eq("type", "api_proxy")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dlConnectionError || !dlConnection) {
    throw new Error("No enabled API connection found");
  }

  return {
    baseUrl: dlConnection.base_url,
    apiKey: resolveApiKeyFromRecord(dlConnection),
    authHeader: resolveAuthHeaderFromRecord(dlConnection),
    authHeaderName: resolveAuthHeaderNameFromRecord(dlConnection),
    headersJson: resolveHeadersFromRecord(dlConnection),
  };
}

async function resolveLogCompanyId(
  supabaseService: ReturnType<typeof createClient>,
  userId: string,
  requestedCompanyId?: string | null,
): Promise<string | null> {
  if (requestedCompanyId) return requestedCompanyId;

  const { data: userCompanies } = await supabaseService
    .from("user_companies")
    .select("company_id, all_companies")
    .eq("user_id", userId)
    .limit(20);

  const firstDirectCompany = (userCompanies || []).find((row: { company_id: string | null }) => row.company_id)?.company_id;
  if (firstDirectCompany) return String(firstDirectCompany);

  const hasAllCompanies = Boolean((userCompanies || []).some((row: { all_companies: boolean | null }) => row.all_companies === true));
  if (hasAllCompanies) {
    const { data: firstCompany } = await supabaseService
      .from("companies")
      .select("id")
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstCompany?.id) return String(firstCompany.id);
  }

  // Fallback: try profiles.company_id (for super_admins without user_companies entries)
  const { data: profile } = await supabaseService
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.company_id) return String(profile.company_id);

  // Last resort: return first company alphabetically
  const { data: anyCompany } = await supabaseService
    .from("companies")
    .select("id")
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  return anyCompany?.id ? String(anyCompany.id) : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as DabProxyRequest;
    if (!payload.path && !payload.nextLink) {
      return new Response(JSON.stringify({ error: "path_or_nextLink_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const connection = await getConnectionConfig(supabaseService, payload.connectionId);
    const candidateUrls = buildCandidateUrls(connection.baseUrl, payload);

    const isEmployeesPath = Boolean(payload.path && normalizePath(payload.path) === "funcionarios");
    const shouldLogSync = payload.logSync === true || (isEmployeesPath && payload.allPages === true);
    const syncType = payload.syncType || "employees_api_proxy";
    const nowIso = new Date().toISOString();

    let syncLogId: string | null = null;
    if (shouldLogSync) {
      const resolvedLogCompanyId = await resolveLogCompanyId(supabaseService, user.id, payload.companyId || null);

      const { data: createdLog } = await supabaseService
        .from("sync_logs")
        .insert({
          company_id: resolvedLogCompanyId,
          sync_type: syncType,
          status: "running",
          started_at: nowIso,
          records_received: 0,
          errors: {
            path: payload.path || null,
            connection_id: payload.connectionId || null,
            all_pages: payload.allPages === true,
            requested_company_id: payload.companyId || null,
            resolved_company_id: resolvedLogCompanyId,
          },
        })
        .select("id")
        .maybeSingle();

      syncLogId = createdLog?.id ? String(createdLog.id) : null;
    }

    const upstreamHeaders: Record<string, string> = {
      Accept: "application/json",
      ...(connection.headersJson || {}),
    };

    if (connection.apiKey) {
      const apiKeyHeaderName = connection.authHeaderName || "X-API-Key";
      upstreamHeaders[apiKeyHeaderName] = connection.apiKey;
    }
    if (connection.authHeader) {
      upstreamHeaders["Authorization"] = connection.authHeader;
    }

    let upstreamResponse: Response | null = null;
    let lastBody: unknown = null;

    for (const targetUrl of candidateUrls) {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: upstreamHeaders,
      });

      const text = await response.text();
      const parsed = safeParseJson(text);
      const body = parsed.ok ? parsed.value : { raw_text: text, parse_error: parsed.error };

      if (response.ok && !parsed.ok) {
        if (syncLogId) {
          await supabaseService
            .from("sync_logs")
            .update({
              status: "error",
              completed_at: new Date().toISOString(),
              records_failed: 1,
              errors: {
                message: "Upstream retornou JSON inválido",
                parse_error: parsed.error,
                target_url: targetUrl,
                raw_text_preview: String(text || "").slice(0, 4000),
              },
            })
            .eq("id", syncLogId);
        }

        return new Response(
          JSON.stringify({
            error: "upstream_invalid_json",
            parse_error: parsed.error,
            raw_text_preview: String(text || "").slice(0, 4000),
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (response.ok) {
        const allPagesMode = payload.allPages === true;
        const maxPages = Math.max(1, Math.min(Number(payload.maxPages || 200), 1000));

        if (allPagesMode) {
          let pagesFetched = 1;
          let rowsReceived = 0;
          const aggregatedRows = extractRowsFromBody(body);
          rowsReceived += aggregatedRows.length;

          const firstHeaderNext = extractNextLinkFromHeaders(response.headers);
          const firstBodyNext = extractNextLinkFromBody(body);
          let nextUrl = firstHeaderNext || firstBodyNext;
          let hadNextLink = Boolean(nextUrl);

          let usedOffsetFallback = false;
          let chosenQueryForFallback: Record<string, string | number> | null = null;

          // If no nextLink is provided but the first page looks capped (commonly 100),
          // try offset/page-based pagination patterns.
          if (!nextUrl && aggregatedRows.length > 0) {
            const pageSize = aggregatedRows.length;
            const seen = new Set<string>(aggregatedRows.map(employeeRowKey));

            let pageIndex = 2;
            while (pageIndex <= maxPages) {
              const queryCandidates = chosenQueryForFallback
                ? [chosenQueryForFallback]
                : buildPagedQueryCandidates(pageSize, pageIndex);

              let bestRows: Record<string, unknown>[] = [];
              let bestQuery: Record<string, string | number> | null = null;

              for (const query of queryCandidates) {
                const urlObject = new URL(targetUrl);
                applyQueryParams(urlObject, query);

                const pageResponse = await fetch(urlObject.toString(), {
                  method: "GET",
                  headers: upstreamHeaders,
                });

                const pageText = await pageResponse.text();
                const pageBody = pageText ? JSON.parse(pageText) : {};

                if (!pageResponse.ok) {
                  continue;
                }

                const pageRows = extractRowsFromBody(pageBody);
                if (!pageRows.length) {
                  continue;
                }

                let newCount = 0;
                for (const row of pageRows) {
                  const key = employeeRowKey(row);
                  if (!seen.has(key)) newCount += 1;
                }

                if (newCount > 0) {
                  bestRows = pageRows;
                  bestQuery = query;
                  break;
                }
              }

              if (!bestRows.length || !bestQuery) {
                break;
              }

              usedOffsetFallback = true;
              chosenQueryForFallback = bestQuery;

              for (const row of bestRows) {
                const key = employeeRowKey(row);
                if (seen.has(key)) continue;
                seen.add(key);
                aggregatedRows.push(row);
              }

              rowsReceived = aggregatedRows.length;
              pagesFetched += 1;
              pageIndex += 1;
            }
          }

          while (nextUrl && pagesFetched < maxPages) {
            const normalizedNext = normalizeNextLink(nextUrl, connection.baseUrl);
            const pageResponse = await fetch(normalizedNext, {
              method: "GET",
              headers: upstreamHeaders,
            });

            const pageText = await pageResponse.text();
            const pageBody = pageText ? JSON.parse(pageText) : {};

            if (!pageResponse.ok) {
              if (syncLogId) {
                await supabaseService
                  .from("sync_logs")
                  .update({
                    status: "partial",
                    completed_at: new Date().toISOString(),
                    records_received: rowsReceived,
                    records_failed: 1,
                    errors: {
                      message: "Falha em paginação allPages no dab-proxy",
                      failed_status: pageResponse.status,
                      pages_fetched: pagesFetched,
                      had_next_link: hadNextLink,
                    },
                  })
                  .eq("id", syncLogId);
              }

              return new Response(
                JSON.stringify({
                  error: "upstream_error",
                  status: pageResponse.status,
                  details: pageBody,
                  data: aggregatedRows,
                  meta: {
                    partial: true,
                    pages_fetched: pagesFetched,
                    records_received: rowsReceived,
                    had_next_link: hadNextLink,
                  },
                }),
                {
                  status: pageResponse.status,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
              );
            }

            const pageRows = extractRowsFromBody(pageBody);
            aggregatedRows.push(...pageRows);
            rowsReceived += pageRows.length;
            pagesFetched += 1;

            const pageHeaderNext = extractNextLinkFromHeaders(pageResponse.headers);
            const pageBodyNext = extractNextLinkFromBody(pageBody);
            nextUrl = pageHeaderNext || pageBodyNext;
            if (nextUrl) hadNextLink = true;
          }

          if (syncLogId) {
            await supabaseService
              .from("sync_logs")
              .update({
                status: "success",
                completed_at: new Date().toISOString(),
                records_received: rowsReceived,
                records_failed: 0,
                errors: {
                  pages_fetched: pagesFetched,
                  had_next_link: hadNextLink,
                  all_pages: true,
                  max_pages: maxPages,
                  pagination_mode: usedOffsetFallback ? "offset_fallback" : hadNextLink ? "next_link" : "none",
                  fallback_query: usedOffsetFallback ? chosenQueryForFallback : null,
                },
              })
              .eq("id", syncLogId);
          }

          return new Response(
            JSON.stringify({
              data: aggregatedRows,
              meta: {
                pages_fetched: pagesFetched,
                records_received: rowsReceived,
                had_next_link: hadNextLink,
                all_pages: true,
                pagination_mode: usedOffsetFallback ? "offset_fallback" : hadNextLink ? "next_link" : "none",
              },
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const headerNextLink = extractNextLinkFromHeaders(response.headers);
        let normalizedBody: unknown = body;

        if (Array.isArray(body)) {
          normalizedBody = {
            data: body,
            ...(headerNextLink ? { nextLink: headerNextLink } : {}),
          };
        } else if (body && typeof body === "object") {
          const hasAnyNext =
            body.nextLink ||
            body.next ||
            body.next_link ||
            body.nextlink ||
            body["@odata.nextLink"] ||
            body["@odata.nextlink"];

          if (!hasAnyNext && headerNextLink) {
            normalizedBody = {
              ...body,
              nextLink: headerNextLink,
            };
          }
        }

        if (syncLogId) {
          await supabaseService
            .from("sync_logs")
            .update({
              status: "success",
              completed_at: new Date().toISOString(),
              records_received: extractRowsFromBody(normalizedBody).length,
              records_failed: 0,
              errors: {
                all_pages: false,
                had_next_link: Boolean(headerNextLink || extractNextLinkFromBody(normalizedBody)),
              },
            })
            .eq("id", syncLogId);
        }

        return new Response(JSON.stringify(normalizedBody), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      upstreamResponse = response;
      lastBody = body;

      if (response.status !== 404) {
        break;
      }
    }

    if (syncLogId) {
      await supabaseService
        .from("sync_logs")
        .update({
          status: "error",
          completed_at: new Date().toISOString(),
          records_failed: 1,
          errors: {
            message: "Falha ao consultar upstream no dab-proxy",
            status: upstreamResponse?.status || 502,
            details: lastBody,
          },
        })
        .eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        error: "upstream_error",
        status: upstreamResponse?.status || 502,
        details: lastBody,
      }),
      {
        status: upstreamResponse?.status || 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return new Response(
      JSON.stringify({ error: "internal_error", details: sanitizeError(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
