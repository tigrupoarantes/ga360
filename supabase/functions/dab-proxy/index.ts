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
}

interface ApiConnectionConfig {
  baseUrl: string;
  apiKey?: string;
  authHeader?: string;
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

function buildUrl(baseUrl: string, payload: DabProxyRequest): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  if (payload.nextLink) {
    if (/^https?:\/\//i.test(payload.nextLink)) {
      return payload.nextLink;
    }
    return new URL(payload.nextLink, base).toString();
  }

  const normalized = normalizePath(payload.path || "");
  if (!ALLOWED_PATHS.has(normalized)) {
    throw new Response(
      JSON.stringify({ error: "path_not_allowed", allowedPaths: [...ALLOWED_PATHS] }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const endpoint = `v1/${normalized}`;
  const url = new URL(endpoint, base);

  if (payload.query) {
    for (const [key, value] of Object.entries(payload.query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function resolveApiKeyFromRecord(record: Record<string, any>): string | undefined {
  const headersJson = record.headers_json || {};
  const authConfigJson = record.auth_config_json || {};

  return (
    record.api_key ||
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

async function getConnectionConfig(supabaseService: ReturnType<typeof createClient>): Promise<ApiConnectionConfig> {
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

    const connection = await getConnectionConfig(supabaseService);
    const targetUrl = buildUrl(connection.baseUrl, payload);

    const upstreamHeaders: Record<string, string> = {
      Accept: "application/json",
    };

    if (connection.apiKey) {
      upstreamHeaders["X-API-Key"] = connection.apiKey;
    }
    if (connection.authHeader) {
      upstreamHeaders["Authorization"] = connection.authHeader;
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });

    const text = await upstreamResponse.text();
    const body = text ? JSON.parse(text) : {};

    if (!upstreamResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "upstream_error",
          status: upstreamResponse.status,
          details: body,
        }),
        {
          status: upstreamResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
