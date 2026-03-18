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
  fetchAll?: boolean;
  autoSyncWhenEmpty?: boolean;
  syncNow?: boolean;
  syncMaxPages?: number;
  syncAllPages?: boolean;
  syncMonth?: number;
  // Ações de rastreamento de jobs e recálculo
  action?: string;       // "getJobStatus" | "listRecentJobs" | "recalcPivot"
  jobId?: string;        // UUID do job para consulta de status
  previewOnly?: boolean; // se true, calcula stats mas não escreve no banco
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

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
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
  const missingTable = (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("could not find the table")
  );
  return missingTable && (
    message.includes("vw_pagamento_verba_pivot_mensal") ||
    message.includes("payroll_verba_pivot")
  );
}

function isSchemaExposureError(error: any) {
  const message = normalizeErrorMessage(error);
  return message.includes("schema") && message.includes("must be one of the following");
}

function isMissingColumnError(error: any) {
  const message = normalizeErrorMessage(error);
  return message.includes("column") && message.includes("does not exist");
}

function isMissingSpecificColumn(error: any, columnName: string) {
  const message = normalizeErrorMessage(error);
  return isMissingColumnError(error) && message.includes(String(columnName).toLowerCase());
}

function buildVerbasQuery(
  supabaseAdmin: any,
  schemaName: "public" | "gold",
  allowedCompanyIds: string[],
  body: VerbasSecureQueryRequest,
  from: number,
  to: number,
  options?: { enableEmployeeFilters?: boolean; fetchAll?: boolean },
) {
  // Queries directly from the pivot table (pre-aggregated, 12x fewer rows than long format)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _schemaName = schemaName; // kept for signature compatibility
  let queryBase = supabaseAdmin.from("payroll_verba_pivot");

  let query = queryBase
    .select("*", { count: "exact" })
    .in("company_id", allowedCompanyIds)
    .order("ano", { ascending: false })
    .order("razao_social", { ascending: true })
    .order("nome_funcionario", { ascending: true });

  if (!options?.fetchAll) {
    query = query.range(from, to);
  }

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

  const enableEmployeeFilters = options?.enableEmployeeFilters !== false;

  if (enableEmployeeFilters) {
    if (body.department?.trim()) {
      query = query.ilike("employee_department", `%${body.department.trim()}%`);
    }

    if (body.unit?.trim()) {
      query = query.ilike("employee_unidade", `%${body.unit.trim()}%`);
    }

    if (body.position?.trim()) {
      query = query.ilike("employee_position", `%${body.position.trim()}%`);
    }

    if (body.accountingGroup?.trim()) {
      query = query.ilike("employee_accounting_group", `%${body.accountingGroup.trim()}%`);
    }
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
  jobId?: string | null,
  previewOnly?: boolean,
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

  // Passa job_id para que sync-verbas atualize o progresso
  if (jobId) {
    payload.job_id = jobId;
  }

  if (previewOnly) {
    payload.preview_only = true;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (syncApiKey) {
    headers["x-api-key"] = syncApiKey;
  }

  if (!syncApiKey && serviceRoleKey) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  // Timeout curto (8s): apenas garante que sync-verbas recebeu a requisição.
  // O sync continua em background até 150s; o frontend usa polling via verbas_sync_jobs.
  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 8_000);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-verbas`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: abortCtrl.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Falha ao sincronizar verbas via datalake: ${response.status} ${text}`);
    }

    const json = await response.json().catch(() => ({}));
    return json;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      // sync-verbas continua rodando em background no servidor; frontend polling via verbas_sync_jobs
      return { sync_started: true, timed_out: true, job_id: jobId, message: "Sincronização em andamento — acompanhe o progresso pelo painel de status." };
    }
    throw err;
  }
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
  // Verifica se é super_admin, ceo ou diretor — esses roles têm acesso a todas as empresas
  const { data: userRoles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const seniorRoles = ["super_admin", "ceo", "diretor"];
  const isSenior = (userRoles || []).some((r: any) => seniorRoles.includes(r.role));

  const { data: userCompanies, error } = await supabaseAdmin
    .from("user_companies")
    .select("company_id, all_companies")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = userCompanies || [];
  const allCompanies = isSenior || rows.some((row: any) => row.all_companies === true);
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

    // ── Ações de rastreamento de jobs (não requerem permissão de verbas) ─────
    if (body.action === "getJobStatus" && body.jobId) {
      const { data: jobData } = await supabaseAdmin
        .from("verbas_sync_jobs")
        .select("*")
        .eq("id", body.jobId)
        .single();
      return new Response(JSON.stringify({ job: jobData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "listRecentJobs") {
      const { data: jobsData } = await supabaseAdmin
        .from("verbas_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return new Response(JSON.stringify({ jobs: jobsData || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Recalcular associações via staging → pivot (requer permissão de admin/verbas) ──
    if (body.action === "recalcPivot") {
      // Conta linhas no staging para diagnóstico
      const { count: stagingCount } = await supabaseAdmin
        .from("payroll_verba_staging")
        .select("*", { count: "exact", head: true });

      const targetAno = (body.ano && body.ano >= 2000) ? body.ano : null;

      const { data: applyData, error: applyError } = await supabaseAdmin
        .rpc("apply_payroll_staging", { p_ano: targetAno });

      if (applyError) {
        return new Response(JSON.stringify({ error: applyError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = (applyData as any) || {};
      return new Response(JSON.stringify({
        staging_rows: stagingCount ?? 0,
        inserted_or_updated: result.inserted_or_updated ?? 0,
        cpfs_sem_empresa: result.cpfs_sem_empresa ?? 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const fetchAll = body.fetchAll === true;
    const page = Math.max(1, Number(body.page || 1));
    const pageSize = Math.min(1000, Math.max(1, Number(body.pageSize || 50)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const autoSyncWhenEmpty = body.autoSyncWhenEmpty !== false;
    const syncNow = body.syncNow === true;
    const previewOnly = body.previewOnly === true;
    let syncResult: Record<string, unknown> | undefined;
    let syncError: string | undefined;

    if (syncNow || previewOnly) {
      if (!hasFullAccess) {
        return new Response(JSON.stringify({ error: "Sem permissão para sincronizar VERBAS.", code: "PERMISSION_DENIED" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const syncApiKey = Deno.env.get("SYNC_API_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      // Cria registro de job antes de disparar sync-verbas (somente no sync real)
      let syncJobId: string | null = null;
      if (!previewOnly) {
        try {
          const { data: jobData } = await supabaseAdmin
            .from("verbas_sync_jobs")
            .insert({
              ano: body.ano ?? new Date().getFullYear(),
              mes: (body.syncMonth && body.syncMonth >= 1 && body.syncMonth <= 12) ? body.syncMonth : null,
              status: "queued",
              metadata: {
                all_pages: body.syncAllPages ?? false,
                max_pages: body.syncMaxPages ?? 25,
                company_id: body.companyId ?? null,
              },
            })
            .select("id")
            .single();
          syncJobId = jobData?.id ?? null;
        } catch (_jobInsertErr) {
          // job tracking é best-effort — não bloqueia o sync
        }
      }

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
          syncJobId,
          previewOnly,
        );
        // Preview mode: retorna resultado imediatamente sem buscar dados do banco
        if (previewOnly && syncResult) {
          return new Response(JSON.stringify({ success: true, preview: syncResult }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Garante que job_id está na resposta para polling do frontend
        if (syncJobId && syncResult) {
          syncResult.job_id = syncJobId;
        } else if (syncJobId) {
          syncResult = { sync_started: true, job_id: syncJobId };
        }
      } catch (syncErr) {
        syncError = String(syncErr);

        const logCompanyId = body.companyId || allowedCompanyIds[0] || null;
        const nowIso = new Date().toISOString();

        await supabaseAdmin
          .from("sync_logs")
          .insert({
            company_id: logCompanyId,
            sync_type: "verbas",
            status: "error",
            started_at: nowIso,
            completed_at: nowIso,
            records_received: 0,
            records_failed: 1,
            errors: {
              message: syncError,
              syncMonth: body.syncMonth ?? null,
              syncYear: body.ano ?? null,
              companyId: body.companyId ?? null,
              department: body.department ?? null,
              position: body.position ?? null,
              syncAllPages: body.syncAllPages ?? null,
              syncMaxPages: body.syncMaxPages ?? null,
            },
          });
      }
    }

    let usedEmployeeFiltersInDb = true;
    let result = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to, { enableEmployeeFilters: true, fetchAll });

    if (result.error && isMissingColumnError(result.error)) {
      // View doesn't have employee_* columns yet; fall back to old enrichment + in-memory filtering.
      usedEmployeeFiltersInDb = false;
      result = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to, { enableEmployeeFilters: false, fetchAll });
    }

    if (result.error && (isMissingViewError(result.error) || isSchemaExposureError(result.error))) {
      result = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to, { enableEmployeeFilters: usedEmployeeFiltersInDb, fetchAll });
      if (result.error && usedEmployeeFiltersInDb && isMissingColumnError(result.error)) {
        usedEmployeeFiltersInDb = false;
        result = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to, { enableEmployeeFilters: false, fetchAll });
      }
    }

    const { data, error, count } = result;
    if (error) {
      if (isMissingViewError(error)) {
        throw new Error(
          "Tabela payroll_verba_pivot não encontrada no banco. Execute a migration 20260316100000_create_payroll_verba_pivot.sql no projeto remoto.",
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
        let retry = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to, { enableEmployeeFilters: usedEmployeeFiltersInDb, fetchAll });

        if (retry.error && (isMissingViewError(retry.error) || isSchemaExposureError(retry.error))) {
          retry = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to, { enableEmployeeFilters: usedEmployeeFiltersInDb, fetchAll });
          if (retry.error && usedEmployeeFiltersInDb && isMissingColumnError(retry.error)) {
            usedEmployeeFiltersInDb = false;
            retry = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to, { enableEmployeeFilters: false, fetchAll });
          }
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
      let retry = await buildVerbasQuery(supabaseAdmin, "public", allowedCompanyIds, body, from, to, { enableEmployeeFilters: usedEmployeeFiltersInDb, fetchAll });

      if (retry.error && (isMissingViewError(retry.error) || isSchemaExposureError(retry.error))) {
        retry = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to, { enableEmployeeFilters: usedEmployeeFiltersInDb, fetchAll });
        if (retry.error && usedEmployeeFiltersInDb && isMissingColumnError(retry.error)) {
          usedEmployeeFiltersInDb = false;
          retry = await buildVerbasQuery(supabaseAdmin, "gold", allowedCompanyIds, body, from, to, { enableEmployeeFilters: false, fetchAll });
        }
      }

      if (!retry.error) {
        result = retry;
      }
    }

    const rows = result.data || [];
    const total = result.count || 0;

    // Enforce "only active employees" rule (CPF as PK):
    // - If CPF doesn't exist among active employees, ignore the verba row.
    // - Always enrich employee_* fields from external_employees (QLP model).
    const companyIds = [...new Set(rows.map((row: any) => row.company_id).filter(Boolean))];
    const cpfs = [...new Set(rows.map((row: any) => normalizeDigits(row.cpf)).filter((value: string) => value.length === 11))];

    const employeeByCompanyCpf = new Map<string, any>();
    if (cpfs.length > 0) {
      const loadedEmployees: any[] = [];
      for (const cpfChunk of chunkArray(cpfs, 500)) {
        const attempt = await supabaseAdmin
          .from("external_employees")
          .select(
            "company_id, cpf, full_name, department, unidade, position, accounting_group, is_active, is_disabled, metadata, contract_company_id, accounting_company_id",
          )
          .in("cpf", cpfChunk);

        if (attempt.error && (isMissingSpecificColumn(attempt.error, "is_disabled") || isMissingSpecificColumn(attempt.error, "contract_company_id") || isMissingSpecificColumn(attempt.error, "accounting_company_id"))) {
          const fallback = await supabaseAdmin
            .from("external_employees")
            .select(
              "company_id, cpf, full_name, department, unidade, position, accounting_group, is_active, metadata",
            )
            .in("cpf", cpfChunk);

          if (fallback.error) {
            throw fallback.error;
          }

          loadedEmployees.push(...(fallback.data || []));
          continue;
        }

        if (attempt.error) {
          throw attempt.error;
        }

        loadedEmployees.push(...(attempt.data || []));
      }

      for (const employee of loadedEmployees) {
        const cpfDigits = normalizeDigits(employee.cpf);
        if (cpfDigits.length !== 11) continue;
        if (employee.is_active === false) continue;
        if (employee.is_disabled === true) continue;

        // Accept employees that belong (by payroll or accounting company) to any company present in the verba rows.
        if (companyIds.length > 0) {
          const inPayroll = companyIds.includes(employee.company_id);
          const inAccounting = employee.accounting_company_id && companyIds.includes(employee.accounting_company_id);
          if (!inPayroll && !inAccounting) continue;
        }

        // Key by CPF only so that lookup always succeeds regardless of which
        // company_id appears on the verba row vs. the employee record.
        const key = cpfDigits;
        const existing = employeeByCompanyCpf.get(key);
        if (!existing) {
          employeeByCompanyCpf.set(key, employee);
          continue;
        }

        // Prefer explicitly active rows
        if (existing?.is_active !== true && employee?.is_active === true) {
          employeeByCompanyCpf.set(key, employee);
        }
      }
    }

    const rowsActiveOnly = rows
      .map((row: any) => {
        const key = normalizeDigits(row.cpf);
        const employee = employeeByCompanyCpf.get(key);
        if (!employee) return null;

        const accountingGroup = resolveAccountingGroupLabel(employee);
        return {
          ...row,
          employee_department: employee?.department || null,
          employee_unit: employee?.unidade || null,
          employee_position: employee?.position || null,
          employee_accounting_group: accountingGroup,
          compare_group_key: `${row.company_id || ""}|${String(employee?.position || "SEM_CARGO").trim().toUpperCase()}`,
        };
      })
      .filter(Boolean);

    // Fast path: view already provides employee_* columns, so we can return directly.
    if (usedEmployeeFiltersInDb) {
      const securedRows = (hasFullAccess ? rowsActiveOnly : rowsActiveOnly.map(maskRow)).map((row: any) => ({
        ...row,
        masked: !hasFullAccess,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          access: hasFullAccess ? "full" : "masked",
          page,
          pageSize,
          total,
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
    }

    const filteredRows = rowsActiveOnly.filter((row: any) => {
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
        total,
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
