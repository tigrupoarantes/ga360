import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PATHS = new Set(["funcionarios"]);

interface DabProxyRequest {
  path?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  nextLink?: string;
  connectionId?: string;
}

interface ApiConnectionConfig {
  baseUrl: string;
  apiKey?: string;
  authHeader?: string;
  authHeaderName?: string;
  headersJson?: Record<string, string>;
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

function applyQueryParams(url: URL, query?: Record<string, string | number | boolean | null | undefined>) {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
}

function buildCandidateUrls(baseUrl: string, payload: DabProxyRequest): string[] {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  if (payload.nextLink) {
    if (/^https?:\/\//i.test(payload.nextLink)) {
      return [payload.nextLink];
    }
    return [new URL(payload.nextLink, base).toString()];
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

  if (normalizedPathname.endsWith("/funcionarios")) {
    applyQueryParams(baseUrlObject, payload.query);
    return [baseUrlObject.toString()];
  }

  const endpoints: string[] = [];

  if (normalizedPathname.endsWith("/api") || normalizedPathname.endsWith("/v1/api")) {
    endpoints.push(normalized);
  } else if (normalizedPathname.endsWith("/v1")) {
    endpoints.push(`api/${normalized}`);
    endpoints.push(normalized);
  } else {
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

serve(async (req) => {
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
    let lastBody: any = null;

    for (const targetUrl of candidateUrls) {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: upstreamHeaders,
      });

      const text = await response.text();
      const body = text ? JSON.parse(text) : {};

      if (response.ok) {
        return new Response(JSON.stringify(body), {
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
