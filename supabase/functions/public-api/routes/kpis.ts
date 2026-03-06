// routes/kpis.ts — GET /kpis/summary (wraps kpi-summary edge function)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ApiKeyContext } from "../_auth.ts";
import { ok, forbidden, serverError, err } from "../_response.ts";

export async function handleKpis(
  req: Request, path: string, ctx: ApiKeyContext,
): Promise<Response> {
  if (!ctx.permissions.includes("kpis:read")) return forbidden();

  if (path === "/kpis/summary" && req.method === "GET") {
    return getKpiSummary(req, ctx);
  }

  return err("KPIs route not found", "NOT_FOUND", 404);
}

async function getKpiSummary(req: Request, ctx: ApiKeyContext): Promise<Response> {
  const url = new URL(req.url);
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  const channelCode = url.searchParams.get("channel_code");
  const buId = url.searchParams.get("bu_id");
  const industryId = url.searchParams.get("industry_id");

  if (!startDate || !endDate) {
    return err("Parâmetros obrigatórios: start_date, end_date (YYYY-MM-DD)", "MISSING_PARAMS");
  }

  // Reusa a lógica da kpi-summary edge function via invocação interna
  // (evita duplicar a lógica de cálculo de KPIs)
  const kpiUrl = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/kpi-summary`);
  kpiUrl.searchParams.set("company_id", ctx.companyId);
  kpiUrl.searchParams.set("start_date", startDate);
  kpiUrl.searchParams.set("end_date", endDate);
  if (channelCode) kpiUrl.searchParams.set("channel_code", channelCode);
  if (buId) kpiUrl.searchParams.set("bu_id", buId);
  if (industryId) kpiUrl.searchParams.set("industry_id", industryId);

  try {
    const response = await fetch(kpiUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return serverError(`kpi-summary error: ${errText}`);
    }

    const kpiData = await response.json();
    return ok(kpiData);
  } catch (e: any) {
    return serverError(e.message ?? "Falha ao consultar KPIs");
  }
}
