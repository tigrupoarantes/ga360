import { supabase } from "@/integrations/supabase/external-client";

const SOURCE_SYSTEM = "dab_api";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 200;
const ENABLE_EMPLOYEE_DEACTIVATION = false;
const ENABLE_FULL_REFRESH_REPLACE = true;
const INSERT_BATCH_SIZE = 500;

export interface DabEmployee {
  id_funcionario: string;
  cpf: string | null;
  nome_funcionario: string;
  data_admissao: string | null;
  contabilizacao?: string | null;
  cargo?: string | null;
  categoria?: string | null;
  departamento?: string | null;
  funcao?: string | null;
  cod_empresa?: number | null;
  nome_fantasia?: string | null;
}

interface DabPageResponse {
  value?: DabEmployee[];
  data?: DabEmployee[];
  items?: DabEmployee[];
  results?: DabEmployee[];
  nextLink?: string;
  next?: string;
  next_link?: string;
  nextlink?: string;
  "@odata.nextLink"?: string;
  "@odata.nextlink"?: string;
}

interface CompanyLookup {
  byName: Map<string, string>;
  byExternalId: Map<string, string>;
}

function buildEmployeeUniqueKey(companyId: string | null | undefined, externalId: string | null | undefined): string {
  return `${companyId || "__null__"}::${externalId || ""}`;
}

function normalizeDocument(value: string | null | undefined): string | null {
  const digits = (value || "").replace(/\D/g, "");
  return digits || null;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeName(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeExternalCode(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function maskSensitiveForLog(value: string | null | undefined): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function trackEmployeesApiError(status: number | undefined, context: string, details?: unknown) {
  console.error("[employees_api]", {
    status: status ?? 0,
    context,
    details,
  });
}

async function fetchCompaniesLookup(): Promise<CompanyLookup> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, external_id");

  if (error) throw error;

  const byName = new Map<string, string>();
  const byExternalId = new Map<string, string>();

  for (const company of data || []) {
    if (company.name) {
      byName.set(normalizeName(company.name), company.id);
    }
    if (company.external_id) {
      byExternalId.set(normalizeExternalCode(company.external_id), company.id);
    }
  }

  return { byName, byExternalId };
}

function resolveCompanyId(employee: DabEmployee, lookup: CompanyLookup): string | null {
  const byCode = normalizeExternalCode(employee.cod_empresa);
  if (byCode && lookup.byExternalId.has(byCode)) {
    return lookup.byExternalId.get(byCode) || null;
  }

  const byName = normalizeName(employee.nome_fantasia);
  if (byName && lookup.byName.has(byName)) {
    return lookup.byName.get(byName) || null;
  }

  return null;
}

async function callDabProxy(payload: { path?: string; query?: Record<string, string | number>; nextLink?: string; connectionId?: string }) {
  const { data, error } = await supabase.functions.invoke("dab-proxy", {
    body: payload,
  });

  if (error) {
    const status = error.context?.status;
    let details = "";

    try {
      if (error.context) {
        const responseText = await error.context.text();
        try {
          const responseBody = JSON.parse(responseText || "{}");
          details =
            responseBody?.details?.message ||
            responseBody?.details?.error ||
            responseBody?.error ||
            responseText ||
            "";
        } catch {
          details = responseText || "";
        }
      }
    } catch {
      details = "";
    }

    const payloadContext = {
      path: payload.path,
      hasNextLink: Boolean(payload.nextLink),
      queryKeys: payload.query ? Object.keys(payload.query) : [],
      connectionId: payload.connectionId || null,
    };

    trackEmployeesApiError(status, "dab_proxy_invoke_failed", {
      message: details || error.message,
      payload: payloadContext,
    });

    const fallbackMessage = `HTTP ${status || 0} no dab-proxy (${JSON.stringify(payloadContext)})`;
    const wrappedError = new Error(details || error.message || fallbackMessage) as Error & { status?: number; details?: string };
    wrappedError.status = status;
    wrappedError.details = details || fallbackMessage;
    throw wrappedError;
  }

  return (data || {}) as DabPageResponse;
}

async function resolveEmployeesConnectionId(): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("dl_connections")
    .select("id, name, base_url, is_enabled, updated_at")
    .eq("is_enabled", true)
    .eq("type", "api_proxy")
    .order("updated_at", { ascending: false });

  if (error) {
    trackEmployeesApiError(undefined, "resolve_connection_failed", error.message);
    return undefined;
  }

  const rows = data || [];
  if (rows.length === 0) return undefined;

  const prioritized = [...rows].sort((a, b) => {
    const aScore =
      (String(a.base_url || "").toLowerCase().includes("funcionarios") ? 2 : 0) +
      (String(a.name || "").toLowerCase().includes("funcion") ? 1 : 0);
    const bScore =
      (String(b.base_url || "").toLowerCase().includes("funcionarios") ? 2 : 0) +
      (String(b.name || "").toLowerCase().includes("funcion") ? 1 : 0);
    return bScore - aScore;
  });

  let lastErrorMessage = "";

  for (const row of prioritized) {
    try {
      await callDabProxy({ path: "funcionarios", query: { $first: 1 }, connectionId: row.id });
      return row.id;
    } catch (errorFirst: any) {
      try {
        await callDabProxy({ path: "funcionarios", connectionId: row.id });
        return row.id;
      } catch (errorSecond: any) {
        const msg = errorSecond?.details || errorSecond?.message || errorFirst?.details || errorFirst?.message;
        lastErrorMessage = `connection=${row.id} name=${row.name || "sem_nome"} error=${msg || "unknown_error"}`;
      }
    }
  }

  throw new Error(`Nenhuma conexão API ativa respondeu ao endpoint de funcionários. ${lastErrorMessage}`);
}

async function fetchFirstPageWithFallback(pageSize: number, connectionId?: string): Promise<DabPageResponse> {
  const candidateSizes = [...new Set([pageSize, 50, 20, 10, 1].filter((value) => value > 0))];
  const candidateQueries: Array<Record<string, string | number> | undefined> = [];

  candidateQueries.push(undefined);

  for (const size of candidateSizes) {
    candidateQueries.push({ $first: size });
    candidateQueries.push({ first: size });
    candidateQueries.push({ $top: size });
    candidateQueries.push({ top: size });
    candidateQueries.push({ limit: size });
  }

  let lastError: any = null;
  const attemptMessages: string[] = [];

  for (const query of candidateQueries) {
    try {
      return await callDabProxy(
        query
          ? { path: "funcionarios", query, ...(connectionId ? { connectionId } : {}) }
          : { path: "funcionarios", ...(connectionId ? { connectionId } : {}) },
      );
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      attemptMessages.push(`${JSON.stringify(query || {})} => [${status || 0}] ${error?.details || error?.message || "unknown_error"}`);

      if (status === 401 || status === 403) {
        throw error;
      }
    }
  }

  const attempts = attemptMessages.length > 0 ? ` Tentativas: ${attemptMessages.join(" | ")}` : "";
  const finalMessage = `Falha ao carregar a primeira página do endpoint funcionarios.${attempts}`;

  if (lastError) {
    const wrapped = new Error(finalMessage) as Error & { status?: number; details?: string };
    wrapped.status = lastError?.status;
    wrapped.details = finalMessage;
    throw wrapped;
  }

  throw new Error(finalMessage);
}

function extractPageEmployees(response: DabPageResponse): DabEmployee[] {
  const candidates = [response?.value, response?.data, response?.items, response?.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  const nestedData = (response as any)?.data;
  if (nestedData && typeof nestedData === "object") {
    const nestedCandidates = [nestedData.value, nestedData.items, nestedData.results];
    for (const candidate of nestedCandidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [];
}

function extractNextLink(response: DabPageResponse): string | undefined {
  const links = [
    response?.nextLink,
    response?.next,
    response?.next_link,
    response?.nextlink,
    (response as any)?.["@odata.nextLink"],
    (response as any)?.["@odata.nextlink"],
    (response as any)?.odataNextLink,
    (response as any)?.pagination?.nextLink,
    (response as any)?.pagination?.next,
    (response as any)?.meta?.next,
  ];

  for (const link of links) {
    if (typeof link === "string" && link.trim()) {
      return link.trim();
    }
  }

  return undefined;
}

export async function fetchEmployeesFromDab(pageSize = DEFAULT_PAGE_SIZE): Promise<DabEmployee[]> {
  const employees: DabEmployee[] = [];
  const connectionId = await resolveEmployeesConnectionId();
  let nextLink: string | undefined;
  let pageCount = 0;
  const visitedNextLinks = new Set<string>();

  do {
    const response = nextLink
      ? await callDabProxy({ nextLink, ...(connectionId ? { connectionId } : {}) })
      : await fetchFirstPageWithFallback(pageSize, connectionId);

    const pageData = extractPageEmployees(response);
    employees.push(...pageData);
    nextLink = extractNextLink(response);

    if (nextLink) {
      if (visitedNextLinks.has(nextLink)) {
        throw new Error("Loop de paginação detectado no endpoint de funcionários");
      }
      visitedNextLinks.add(nextLink);
    }

    pageCount += 1;

    if (pageCount > MAX_PAGES) {
      throw new Error("Pagination limit exceeded while loading funcionarios from DAB");
    }
  } while (nextLink);

  return employees;
}

export async function syncEmployeesFromDab(): Promise<{ inserted: number; updated: number; deactivated: number; totalFetched: number }> {
  const [fetchedEmployees, companyLookup] = await Promise.all([
    fetchEmployeesFromDab(DEFAULT_PAGE_SIZE),
    fetchCompaniesLookup(),
  ]);

  if (ENABLE_FULL_REFRESH_REPLACE) {
    if (!Array.isArray(fetchedEmployees) || fetchedEmployees.length === 0) {
      throw new Error("A API retornou 0 funcionários. Limpeza cancelada para evitar apagar dados existentes.");
    }

    const uniquePayloadByKey = new Map<string, Record<string, any>>();

    for (const employee of fetchedEmployees) {
      if (!employee.id_funcionario || !employee.nome_funcionario) continue;

      const companyId = resolveCompanyId(employee, companyLookup);
      const uniqueKey = buildEmployeeUniqueKey(companyId, employee.id_funcionario);

      uniquePayloadByKey.set(uniqueKey, {
        external_id: employee.id_funcionario,
        source_system: SOURCE_SYSTEM,
        full_name: employee.nome_funcionario,
        cpf: normalizeDocument(employee.cpf),
        registration_number: normalizeDocument(employee.cpf),
        hire_date: normalizeDate(employee.data_admissao),
        position: employee.cargo || null,
        department: employee.departamento || null,
        metadata: {
          function_name: employee.funcao || null,
          company_code: employee.cod_empresa ?? null,
          company_name: employee.nome_fantasia || null,
          contabilizacao: employee.contabilizacao || null,
          categoria: employee.categoria || null,
          cpf_masked: maskSensitiveForLog(employee.cpf),
        },
        company_id: companyId,
        is_active: true,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const payloadRows = [...uniquePayloadByKey.values()];

    const { error: clearError } = await supabase
      .from("external_employees")
      .delete()
      .eq("source_system", SOURCE_SYSTEM);

    if (clearError) {
      throw new Error(`Falha ao limpar funcionários atuais: ${clearError.message}`);
    }

    let inserted = 0;

    for (let index = 0; index < payloadRows.length; index += INSERT_BATCH_SIZE) {
      const batch = payloadRows.slice(index, index + INSERT_BATCH_SIZE);
      const { error } = await supabase.from("external_employees").insert(batch);

      if (error) {
        const detailedMessage = [error.message, (error as any).details, (error as any).hint].filter(Boolean).join(" | ");
        throw new Error(`Falha ao inserir lote da sincronização: ${detailedMessage || error.message}`);
      }

      inserted += batch.length;
    }

    return {
      inserted,
      updated: 0,
      deactivated: 0,
      totalFetched: fetchedEmployees.length,
    };
  }

  const externalIds = fetchedEmployees
    .map((employee) => employee.id_funcionario)
    .filter(Boolean);

  const { data: existingRows, error: existingError } = await supabase
    .from("external_employees")
    .select("id, external_id, company_id")
    .eq("source_system", SOURCE_SYSTEM);

  if (existingError) throw existingError;

  const existingByUniqueKey = new Map(
    (existingRows || []).map((row) => [buildEmployeeUniqueKey(row.company_id, row.external_id), row.id]),
  );

  let inserted = 0;
  let updated = 0;

  for (const employee of fetchedEmployees) {
    if (!employee.id_funcionario || !employee.nome_funcionario) continue;

    const companyId = resolveCompanyId(employee, companyLookup);
    const payload = {
      external_id: employee.id_funcionario,
      source_system: SOURCE_SYSTEM,
      full_name: employee.nome_funcionario,
      cpf: normalizeDocument(employee.cpf),
      registration_number: normalizeDocument(employee.cpf),
      hire_date: normalizeDate(employee.data_admissao),
      position: employee.cargo || null,
      department: employee.departamento || null,
      metadata: {
        function_name: employee.funcao || null,
        company_code: employee.cod_empresa ?? null,
        company_name: employee.nome_fantasia || null,
        contabilizacao: employee.contabilizacao || null,
        categoria: employee.categoria || null,
        cpf_masked: maskSensitiveForLog(employee.cpf),
      },
      company_id: companyId,
      is_active: true,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const uniqueKey = buildEmployeeUniqueKey(companyId, employee.id_funcionario);
    const existingId = existingByUniqueKey.get(uniqueKey);

    if (existingId) {
      const { error } = await supabase.from("external_employees").update(payload).eq("id", existingId);
      if (error) {
        const detailedMessage = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
        trackEmployeesApiError(undefined, "update_external_employee_failed", detailedMessage || error.message);
        throw new Error(`Falha ao atualizar funcionário ${employee.id_funcionario}: ${detailedMessage || error.message}`);
      }
      updated += 1;
    } else {
      const { error } = await supabase.from("external_employees").insert(payload);
      if (error) {
        if ((error as any).code === "23505" || String(error.message || "").toLowerCase().includes("duplicate key")) {
          let conflictQuery = supabase
            .from("external_employees")
            .select("id")
            .eq("source_system", SOURCE_SYSTEM)
            .eq("external_id", employee.id_funcionario);

          conflictQuery = companyId === null
            ? conflictQuery.is("company_id", null)
            : conflictQuery.eq("company_id", companyId);

          const { data: conflictingRow } = await conflictQuery.maybeSingle();

          const fallbackId = conflictingRow?.id || existingByUniqueKey.get(uniqueKey);
          if (fallbackId) {
            const { error: retryError } = await supabase
              .from("external_employees")
              .update(payload)
              .eq("id", fallbackId);

            if (!retryError) {
              updated += 1;
              existingByUniqueKey.set(uniqueKey, fallbackId);
              continue;
            }
          }
        }

        const detailedMessage = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
        trackEmployeesApiError(undefined, "insert_external_employee_failed", detailedMessage || error.message);
        throw new Error(`Falha ao inserir funcionário ${employee.id_funcionario}: ${detailedMessage || error.message}`);
      }
      inserted += 1;
      let insertedRowQuery = supabase
        .from("external_employees")
        .select("id")
        .eq("source_system", SOURCE_SYSTEM)
        .eq("external_id", employee.id_funcionario)
        .order("updated_at", { ascending: false })
        .limit(1);

      insertedRowQuery = companyId === null
        ? insertedRowQuery.is("company_id", null)
        : insertedRowQuery.eq("company_id", companyId);

      const { data: insertedRow } = await insertedRowQuery.maybeSingle();

      if (insertedRow?.id) {
        existingByUniqueKey.set(uniqueKey, insertedRow.id);
      }
    }
  }

  let deactivated = 0;
  if (ENABLE_EMPLOYEE_DEACTIVATION && externalIds.length > 0) {
    const { data: currentlyActive, error: activeError } = await supabase
      .from("external_employees")
      .select("id, external_id")
      .eq("source_system", SOURCE_SYSTEM)
      .eq("is_active", true);

    if (activeError) throw activeError;

    const fetchedSet = new Set(externalIds);
    const toDeactivateIds = (currentlyActive || [])
      .filter((row) => !fetchedSet.has(row.external_id))
      .map((row) => row.id);

    if (toDeactivateIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from("external_employees")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", toDeactivateIds);

      if (deactivateError) throw deactivateError;
      deactivated = toDeactivateIds.length;
    }
  }

  return {
    inserted,
    updated,
    deactivated,
    totalFetched: fetchedEmployees.length,
  };
}
