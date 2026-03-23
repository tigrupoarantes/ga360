// @ts-nocheck
// cockpit-sales-sync — Sincroniza KPIs agregados (sales_daily) para TODAS as empresas
//
// Estratégia multi-tenant:
//   1. Busca lista de tenants via /v1/companies
//   2. Para cada tenant, busca /v1/sales_daily?$filter=tenant_id eq '{code}'
//   3. Upsert em sales_fact_daily com company_id resolvido via companies.external_id
//
// Diferente do cockpit-vendas-sync (Chok-only, pedido-level), este sync é:
//   - Multi-tenant (todas as distribuidoras e varejo)
//   - Agregado (1 linha = 1 tenant × 1 dia)
//   - Leve (~5K linhas/ano total)
//
// Deploy: supabase functions deploy cockpit-sales-sync --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────
// Config DAB — resolve conexão via dl_connections
// ──────────────────────────────────────────────────────────
async function getDabConfig(supabaseAdmin: any) {
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

  return { baseUrl, headers };
}

// ──────────────────────────────────────────────────────────
// Fetch paginado do DAB
// ──────────────────────────────────────────────────────────
async function fetchDabPaginated(
  url: string,
  headers: Record<string, string>,
  baseUrl: string,
  maxPages = 50,
  timeoutMs = 25_000,
): Promise<any[]> {
  const allRows: any[] = [];
  let nextUrl: string | null = url;
  let page = 0;

  while (nextUrl && page < maxPages) {
    page++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(nextUrl, { headers, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`DAB ${res.status}: ${txt.slice(0, 300)}`);
      }

      const json = await res.json();
      const rows = json.value ?? json.data ?? (Array.isArray(json) ? json : []);
      allRows.push(...rows);

      const nl = json.nextLink ?? json["@odata.nextLink"] ?? "";
      if (nl) {
        nextUrl = /^https?:\/\//i.test(nl)
          ? nl
          : new URL(nl, baseUrl).toString();
      } else {
        nextUrl = null;
      }
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === "AbortError") {
        console.log(`[sales-sync] Timeout na página ${page}, acumulados: ${allRows.length}`);
        break;
      }
      throw e;
    }
  }

  return allRows;
}

// ──────────────────────────────────────────────────────────
// Resolve company_id do Supabase a partir de external_id (DAB code)
// ──────────────────────────────────────────────────────────
async function buildCompanyMap(supabaseAdmin: any): Promise<Map<string, string>> {
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id, external_id")
    .eq("is_active", true);

  if (error) throw new Error(`Erro ao buscar companies: ${error.message}`);

  const map = new Map<string, string>();
  for (const c of companies || []) {
    if (c.external_id) map.set(String(c.external_id), c.id);
  }
  return map;
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

    // Auth: valida JWT se presente
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
    const {
      data_inicio,
      data_fim,
      tenant_ids,  // opcional: array de tenant_ids específicos
    } = body;

    const today = new Date().toISOString().slice(0, 10);
    const start = data_inicio || today;
    const end = data_fim || today;

    const dab = await getDabConfig(supabaseAdmin);
    const companyMap = await buildCompanyMap(supabaseAdmin);

    // 1. Buscar lista de tenants do DAB
    let tenants: string[];
    if (tenant_ids && Array.isArray(tenant_ids) && tenant_ids.length > 0) {
      tenants = tenant_ids.map(String);
    } else {
      const companiesUrl = `${dab.baseUrl}/companies?$first=100`;
      const dabCompanies = await fetchDabPaginated(companiesUrl, dab.headers, dab.baseUrl, 1);
      tenants = dabCompanies.map((c: any) => String(c.code)).filter(Boolean);
    }

    console.log(`[sales-sync] ${tenants.length} tenants, período ${start} → ${end}`);

    const results: { tenant_id: string; company_id: string | null; rows: number; status: string }[] = [];

    // 2. Para cada tenant, buscar sales_daily do período
    for (const tenantId of tenants) {
      const companyId = companyMap.get(tenantId);
      if (!companyId) {
        console.log(`[sales-sync] Tenant ${tenantId} sem company_id no Supabase — pulando`);
        results.push({ tenant_id: tenantId, company_id: null, rows: 0, status: "skipped: no company mapping" });
        continue;
      }

      try {
        const filter = `tenant_id eq '${tenantId}' and dt_ref ge '${start}' and dt_ref le '${end}'`;
        const salesUrl = `${dab.baseUrl}/sales_daily?$filter=${encodeURIComponent(filter)}&$first=5000&$orderby=dt_ref desc`;
        const salesRows = await fetchDabPaginated(salesUrl, dab.headers, dab.baseUrl, 10);

        if (salesRows.length === 0) {
          results.push({ tenant_id: tenantId, company_id: companyId, rows: 0, status: "ok: no data" });
          continue;
        }

        // 3. Apagar dados antigos do período e re-inserir
        const dates = dateRange(start, end);
        for (const date of dates) {
          await supabaseAdmin
            .from("sales_fact_daily")
            .delete()
            .eq("company_id", companyId)
            .eq("sale_date", date);
        }

        // 4. Mapear e inserir
        const mappedRows = salesRows.map((r: any) => ({
          company_id: companyId,
          sale_date: r.dt_ref,
          net_value: parseFloat(r.vl_venda || 0),
          order_count: parseInt(r.qt_pedidos || 0, 10),
          tenant_id: tenantId,
        }));

        const BATCH = 500;
        for (let i = 0; i < mappedRows.length; i += BATCH) {
          const { error } = await supabaseAdmin
            .from("sales_fact_daily")
            .upsert(mappedRows.slice(i, i + BATCH), {
              onConflict: "company_id,sale_date",
              ignoreDuplicates: false,
            });
          if (error) throw error;
        }

        results.push({ tenant_id: tenantId, company_id: companyId, rows: mappedRows.length, status: "ok" });
        console.log(`[sales-sync] ${tenantId}: ${mappedRows.length} dias sincronizados`);
      } catch (e: any) {
        console.error(`[sales-sync] Erro no tenant ${tenantId}:`, e.message);
        results.push({ tenant_id: tenantId, company_id: companyId, rows: 0, status: `error: ${e.message}` });
      }
    }

    const totalRows = results.reduce((sum, r) => sum + r.rows, 0);
    console.log(`[sales-sync] Concluído: ${totalRows} linhas, ${results.filter(r => r.status === "ok").length}/${tenants.length} tenants`);

    return respond({
      tenants_synced: results,
      total_rows: totalRows,
      period: { start, end },
      synced_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[sales-sync]", err);
    return respond({ error: err.message ?? "Erro interno" }, 500);
  }
});
