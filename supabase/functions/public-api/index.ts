// public-api/index.ts — GA360 Public API v1
// Roteador principal para todos os endpoints REST públicos
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { validateApiKey } from "./_auth.ts";
import { corsHeaders, err, unauthorized } from "./_response.ts";
import { handleMeta } from "./routes/meta.ts";
import { handleGoals } from "./routes/goals.ts";
import { handleMeetings } from "./routes/meetings.ts";
import { handleCompanies } from "./routes/companies.ts";
import { handleKpis } from "./routes/kpis.ts";
import { handleWebhooks } from "./routes/webhooks.ts";

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Normaliza o path: remove prefixo /functions/v1/public-api e /v1
  const raw = new URL(req.url).pathname;
  const path = raw
    .replace(/^\/functions\/v1\/public-api/, "")
    .replace(/^\/v1/, "")
    .replace(/\/$/, "") || "/";

  // Rota pública: OpenAPI spec (não exige auth)
  if (path === "/openapi.json" || path === "/v1/openapi.json") {
    const { handleMeta: meta } = await import("./routes/meta.ts");
    // Passa contexto mínimo para servir a spec
    return meta("/openapi.json", {
      apiKeyId: "",
      companyId: "",
      companyName: "",
      keyPrefix: "",
      permissions: [],
    });
  }

  // Autenticação via X-Api-Key
  const ctx = await validateApiKey(req);
  if (!ctx) return unauthorized();

  // Roteamento por prefixo de path
  try {
    if (path === "/me" || path === "/openapi.json") {
      return handleMeta(path, ctx);
    }
    if (path.startsWith("/goals")) {
      return handleGoals(req, path, ctx);
    }
    if (path.startsWith("/meetings")) {
      return handleMeetings(req, path, ctx);
    }
    if (path.startsWith("/companies")) {
      return handleCompanies(req, path, ctx);
    }
    if (path.startsWith("/kpis")) {
      return handleKpis(req, path, ctx);
    }
    if (path.startsWith("/webhooks")) {
      return handleWebhooks(req, path, ctx);
    }

    return err("Endpoint não encontrado", "NOT_FOUND", 404);
  } catch (e: any) {
    console.error("[public-api] Unhandled error:", e);
    return err(e?.message ?? "Internal server error", "INTERNAL_ERROR", 500);
  }
});
