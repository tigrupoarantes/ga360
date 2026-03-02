// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerbasSecureQueryRequest {
  companyId?: string;
  ano?: number;
  cpf?: string;
  nome?: string;
  tipoVerba?: string;
  department?: string;
  unit?: string;
  position?: string;
  accountingGroup?: string;
  page?: number;
  pageSize?: number;
  autoSyncWhenEmpty?: boolean;
  syncNow?: boolean;
  syncMaxPages?: number;
  syncAllPages?: boolean;
  syncMonth?: number;
}

const ACCOUNTING_CODE_TO_NAME: Record<string, string> = {
  "9": "CHOK AGRO",
  "3": "CHOK DISTRIBUIDORA",
  "4": "BROKER J. ARANTES",
  "5": "LOJAS CHOKDOCE",
  "8": "ESCRITORIO CENTRAL",
  "11": "G4 DISTRIBUIDORA",
};

function normalizeLabel(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function resolveAccountingGroupLabel(employee: any) {
  const metadataCode = normalizeDigits(employee?.metadata?.cod_contabilizacao);
  if (metadataCode && ACCOUNTING_CODE_TO_NAME[metadataCode]) {
    return ACCOUNTING_CODE_TO_NAME[metadataCode];
  }

  const accountingGroup = String(employee?.accounting_group || "").trim();
  if (accountingGroup) return accountingGroup;

  const metadataLabel = String(employee?.metadata?.contabilizacao || "").trim();
  if (metadataLabel) return metadataLabel;

  return "Sem Grupo de Contabilização";
}

function normalizeErrorMessage(error: any) {
  return String(error?.message || error?.error_description || error?.details || "").toLowerCase();
}

function isMissingViewError(error: any) {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("could not find the table")
  ) && message.includes("vw_pagamento_verba_pivot_mensal");
}

function isSchemaExposureError(error: any) {
  const message = normalizeErrorMessage(error);
  return message.includes("schema") && message.includes("must be one of the following");
}

function buildVerbasQuery(
  supabaseAdmin: any,
  schemaName: "public" | "gold",
  allowedCompanyIds: string[],
  body: VerbasSecureQueryRequest,
  from: number,
  to: number,
) {
  let queryBase =
    schemaName === "gold"
      ? supabaseAdmin.schema("gold").from("vw_pagamento_verba_pivot_mensal")
      : supabaseAdmin.from("vw_pagamento_verba_pivot_mensal");

  let query = queryBase
    .select("*", { count: "exact" })
    .in("company_id", allowedCompanyIds)
    .order("ano", { ascending: false })
    .order("razao_social", { ascending: true })
    .order("nome_funcionario", { ascending: true })
    .range(from, to);

  if (body.ano) {
    query = query.eq("ano", Number(body.ano));
  }

  if (body.cpf?.trim()) {
    query = query.ilike("cpf", `%${body.cpf.trim()}%`);
  }

  if (body.nome?.trim()) {
    query = query.ilike("nome_funcionario", `%${body.nome.trim()}%`);
  }

  if (body.tipoVerba?.trim()) {
    query = query.eq("tipo_verba", body.tipoVerba.trim().toUpperCase());
  }

  return query;
}

async function runSyncVerbasIfConfigured(
  supabaseUrl: string,
  syncApiKey: string | null,
  serviceRoleKey: string | null,
  syncMaxPages?: number,
  syncAllPages?: boolean,
  syncMonth?: number,
  syncYear?: number,
  companyId?: string,
  department?: string,
  position?: string,
  replaceScope?: boolean,
) {
  if (!syncApiKey && !serviceRoleKey) return;

  const allPages = syncAllPages === true;

  const payload: Record<string, unknown> = {
    load_from_datalake: true,
    all_pages: allPages,
    max_pages: allPages
      ? 5000
      : Math.max(1, Math.min(500, Number(syncMaxPages || 25))),
  };

  if (syncMonth && syncMonth >= 1 && syncMonth <= 12) {
    payload.target_month = syncMonth;
  }

  if (syncYear && syncYear >= 2000) {
    payload.target_year = syncYear;
  }

  if (companyId) {
    payload.company_id = companyId;
  }

  if (department) {
    payload.department = department;
  }

  if (position) {
    payload.position = position;
  }

  payload.replace_scope = replaceScope !== false;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (syncApiKey) {
    headers["x-api-key"] = syncApiKey;
  }

  if (!syncApiKey && serviceRoleKey) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/sync-verbas`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao sincronizar verbas via datalake: ${response.status} ${text}`);
  }

  const json = await response.json().catch(() => ({}));
  return json;
}

function maskCpf(cpf: string | null | undefined) {
  const digits = String(cpf || "").replace(/\D/g, "");
  if (digits.length < 4) return "***.***.***-**";
  const suffix = digits.slice(-2);
  return `***.***.***-${suffix}`;
}

function maskName(fullName: string | null | undefined) {
  const value = String(fullName || "").trim();
  if (!value) return "Colaborador mascarado";
  const parts = value.split(/\s+/);
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0].slice(0, 1)}*** ${parts[parts.length - 1].slice(0, 1)}***`;
}

function maskRow(row: Record<string, any>) {
  return {
    ...row,
    cpf: maskCpf(row.cpf),
    nome_funcionario: maskName(row.nome_funcionario),
    janeiro: null,
    fevereiro: null,
    marco: null,
    abril: null,
    maio: null,
    junho: null,
    julho: null,
    agosto: null,
    setembro: null,
    outubro: null,
    novembro: null,
    dezembro: null,
    masked: true,
  };
}

async function resolveAllowedCompanyIds(supabaseAdmin: any, userId: string, requestedCompanyId?: string) {
  const { data: userCompanies, error } = await supabaseAdmin
    .from("user_companies")
    .select("company_id, all_companies")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = userCompanies || [];
  const allCompanies = rows.some((row: any) => row.all_companies === true);
  const explicitCompanyIds = rows.map((row: any) => row.company_id).filter(Boolean);

  if (requestedCompanyId) {
    if (allCompanies || explicitCompanyIds.includes(requestedCompanyId)) {
      return [requestedCompanyId];
    }
    throw new Error("TENANT_ACCESS_DENIED");
  }

  if (allCompanies) {
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("is_active", true);

    if (companiesError) throw companiesError;
    return (companies || []).map((c: any) => c.id);
  }

  return [...new Set(explicitCompanyIds)];
}

async function getUserModulePermission(supabaseAdmin: any, userId: string, module: string) {
  const { data: roles, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) throw roleError;

  const isSuperAdmin = (roles || []).some((item: any) => item.role === "super_admin");
  if (isSuperAdmin) {
    return {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
      is_super_admin: true,
    };
  }

  const { data: permission, error: permissionError } = await supabaseAdmin
    .from("user_permissions")
    .select("can_view, can_create, can_edit, can_delete")
    .eq("user_id", userId)
    .eq("module", module)
    .maybeSingle();

  if (permissionError) throw permissionError;

  return {
    can_view: permission?.can_view ?? false,
    can_create: permission?.can_create ?? false,
    can_edit: permission?.can_edit ?? false,
    can_delete: permission?.can_delete ?? false,
    is_super_admin: false,
  };
}

async function getCardPermissions(supabaseAdmin: any, userId: string) {
  const { data: cardId, error: cardIdError } = await supabaseAdmin.rpc("get_verbas_card_id");
  if (cardIdError) throw cardIdError;

  if (!cardId) {
    return { canViewCard: false, canManageCard: false };
  }

  const { data: canViewCard, error: viewError } = await supabaseAdmin.rpc("has_card_permission", {
    _user_id: userId,
    _card_id: cardId,
    _permission: "view",
  });
  if (viewError) throw viewError;

  const { data: canManageCard, error: manageError } = await supabaseAdmin.rpc("has_card_permission", {
    _user_id: userId,
    _card_id: cardId,
    _permission: "manage",
  });
  if (manageError) throw manageError;

  return {
    canViewCard: Boolean(canViewCard),
    canManageCard: Boolean(canManageCard),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token", code: "AUTH_INVALID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as VerbasSecureQueryRequest;

    const allowedCompanyIds = await resolveAllowedCompanyIds(supabaseAdmin, userId, body.companyId);
    if (!allowedCompanyIds.length) {
      return new Response(JSON.stringify({ error: "Acesso a empresas não encontrado.", code: "TENANT_ACCESS_DENIED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminPermission = await getUserModulePermission(supabaseAdmin, userId, "admin");
    const { canViewCard, canManageCard } = await getCardPermissions(supabaseAdmin, userId);

    if (!canViewCard && !adminPermission.can_view && !adminPermission.is_super_admin) {
      return new Response(JSON.stringify({ error: "Sem permissão para visualizar VERBAS.", code: "PERMISSION_DENIED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasFullAccess = Boolean(adminPermission.is_super_admin || adminPermission.can_view || canManageCard);

    const page = Math.max(1, Number(body.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(body.pageSize || 50)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const autoSyncWhenEmpty = body.autoSyncWhenEmpty !== false;
    const syncNow = body.syncNow === true;
    let syncResult: Record<string, unknown> | undefined;
    let syncError: string | undefined;

    if (syncNow) {
      if (!hasFullAccess) {
        return new Response(JSON.stringify({ error: "Sem permissão para sincronizar VERBAS.", code: "PERMISSION_DENIED" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const syncApiKey = Deno.env.get("SYNC_API_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      try {
        syncResult = await runSyncVerbasIfConfigured(
          supabaseUrl,
          syncApiKey,
          serviceRoleKey,
          body.syncMaxPages,
          body.syncAllPages,
          body.syncMonth,
          body.ano,
          body.companyId,
          body.department,
          body.position,
          true,
        );
      } catch (syncErr) {
        syncError = String(syncErr);
      }
    }

    let result = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to);

    if (result.error && (isMissingViewError(result.error) || isSchemaExposureError(result.error))) {
      result = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to);
    }

    const { data, error, count } = result;
    if (error) {
      if (isMissingViewError(error)) {
        throw new Error(
          "Dependência VERBAS não encontrada no banco (view vw_pagamento_verba_pivot_mensal). Execute as migrations de VERBAS no projeto remoto.",
        );
      }

      if (isSchemaExposureError(error)) {
        throw new Error(
          "Schema gold não está exposto na API. Configure o schema em API Settings ou mantenha a view espelho em public.",
        );
      }

      throw error;
    }

    let syncWarning: string | undefined;
    if ((count || 0) === 0 && autoSyncWhenEmpty && page === 1 && !syncNow) {
      const syncApiKey = Deno.env.get("SYNC_API_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      try {
        syncResult = await runSyncVerbasIfConfigured(
          supabaseUrl,
          syncApiKey,
          serviceRoleKey,
          body.syncMaxPages,
          body.syncAllPages,
          body.syncMonth,
          body.ano,
          body.companyId,
          body.department,
          body.position,
          true,
        );
        let retry = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to);

        if (retry.error && (isMissingViewError(retry.error) || isSchemaExposureError(retry.error))) {
          retry = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to);
        }

        if (!retry.error) {
          result = retry;
        }
      } catch (syncError) {
        syncWarning = String(syncError);
        console.warn("Auto-sync de verbas não executado:", syncWarning);
      }
    }

    if (syncNow && !syncError) {
      let retry = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to);

      if (retry.error && (isMissingViewError(retry.error) || isSchemaExposureError(retry.error))) {
        retry = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to);
      }

      if (!retry.error) {
        result = retry;
      }
    }

    const rows = result.data || [];
    const total = result.count || 0;

    const companyIds = [...new Set(rows.map((row: any) => row.company_id).filter(Boolean))];
    const cpfs = [...new Set(rows.map((row: any) => normalizeDigits(row.cpf)).filter((value: string) => value.length === 11))];

    const employeeByCompanyCpf = new Map<string, any>();

    if (companyIds.length > 0 && cpfs.length > 0) {
      const { data: externalEmployees, error: externalEmployeesError } = await supabaseAdmin
        .from("external_employees")
        .select("company_id, cpf, full_name, department, unidade, position, accounting_group, is_active, metadata")
        .in("company_id", companyIds)
        .in("cpf", cpfs);

      if (externalEmployeesError) {
        throw externalEmployeesError;
      }

      for (const employee of externalEmployees || []) {
        const key = `${employee.company_id || ""}|${normalizeDigits(employee.cpf)}`;
        const existing = employeeByCompanyCpf.get(key);
        if (!existing) {
          employeeByCompanyCpf.set(key, employee);
          continue;
        }

        if (existing?.is_active !== true && employee?.is_active === true) {
          employeeByCompanyCpf.set(key, employee);
        }
      }
    }

    const enrichedRows = rows.map((row: any) => {
      const key = `${row.company_id || ""}|${normalizeDigits(row.cpf)}`;
      const employee = employeeByCompanyCpf.get(key);
      const accountingGroup = resolveAccountingGroupLabel(employee);

      return {
        ...row,
        employee_department: employee?.department || null,
        employee_unit: employee?.unidade || null,
        employee_position: employee?.position || null,
        employee_accounting_group: accountingGroup,
        compare_group_key: `${row.company_id || ""}|${String(employee?.position || "SEM_CARGO").trim().toUpperCase()}`,
      };
    });

    const filteredRows = enrichedRows.filter((row: any) => {
      if (body.department?.trim()) {
        if (!normalizeLabel(row.employee_department).includes(normalizeLabel(body.department))) {
          return false;
        }
      }

      if (body.unit?.trim()) {
        if (!normalizeLabel(row.employee_unit).includes(normalizeLabel(body.unit))) {
          return false;
        }
      }

      if (body.position?.trim()) {
        if (!normalizeLabel(row.employee_position).includes(normalizeLabel(body.position))) {
          return false;
        }
      }

      if (body.accountingGroup?.trim()) {
        if (!normalizeLabel(row.employee_accounting_group).includes(normalizeLabel(body.accountingGroup))) {
          return false;
        }
      }

      return true;
    });

    const securedRows = hasFullAccess ? filteredRows.map((row: any) => ({ ...row, masked: false })) : filteredRows.map(maskRow);

    return new Response(
      JSON.stringify({
        success: true,
        access: hasFullAccess ? "full" : "masked",
        page,
        pageSize,
        total: filteredRows.length,
        sync_warning: syncWarning,
        sync_result: syncResult,
        sync_error: syncError,
        rows: securedRows,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Erro em verbas-secure-query:", {
      message: error?.message,
      stack: error?.stack,
    });

    const isTenantError = String(error?.message || "").includes("TENANT_ACCESS_DENIED");

    return new Response(
      JSON.stringify({
        error: isTenantError ? "Usuário sem acesso à empresa solicitada." : error?.message || "Erro interno",
        code: isTenantError ? "TENANT_ACCESS_DENIED" : "INTERNAL_ERROR",
      }),
      {
        status: isTenantError ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
