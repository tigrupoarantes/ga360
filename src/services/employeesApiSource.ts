import { supabase } from "@/integrations/supabase/external-client";

const SOURCE_SYSTEM = "dab_api";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 200;

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
  value: DabEmployee[];
  nextLink?: string;
}

interface CompanyLookup {
  byName: Map<string, string>;
  byExternalId: Map<string, string>;
}

function normalizeDocument(value: string | null | undefined): string | null {
  const digits = (value || "").replace(/\D/g, "");
  return digits || null;
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

async function callDabProxy(payload: { path?: string; query?: Record<string, string | number>; nextLink?: string }) {
  const { data, error } = await supabase.functions.invoke("dab-proxy", {
    body: payload,
  });

  if (error) {
    trackEmployeesApiError(error.context?.status, "dab_proxy_invoke_failed", error.message);
    throw error;
  }

  return (data || {}) as DabPageResponse;
}

export async function fetchEmployeesFromDab(pageSize = DEFAULT_PAGE_SIZE): Promise<DabEmployee[]> {
  const employees: DabEmployee[] = [];
  let nextLink: string | undefined;
  let pageCount = 0;

  do {
    const response = await callDabProxy(
      nextLink
        ? { nextLink }
        : {
            path: "funcionarios",
            query: { $first: pageSize },
          },
    );

    const pageData = Array.isArray(response.value) ? response.value : [];
    employees.push(...pageData);
    nextLink = response.nextLink;
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

  const externalIds = fetchedEmployees
    .map((employee) => employee.id_funcionario)
    .filter(Boolean);

  const { data: existingRows, error: existingError } = await supabase
    .from("external_employees")
    .select("id, external_id")
    .eq("source_system", SOURCE_SYSTEM)
    .in("external_id", externalIds.length > 0 ? externalIds : ["__none__"]);

  if (existingError) throw existingError;

  const existingByExternalId = new Map((existingRows || []).map((row) => [row.external_id, row.id]));

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
      hire_date: employee.data_admissao,
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

    const existingId = existingByExternalId.get(employee.id_funcionario);

    if (existingId) {
      const { error } = await supabase.from("external_employees").update(payload).eq("id", existingId);
      if (error) {
        trackEmployeesApiError(undefined, "update_external_employee_failed", error.message);
        throw error;
      }
      updated += 1;
    } else {
      const { error } = await supabase.from("external_employees").insert(payload);
      if (error) {
        trackEmployeesApiError(undefined, "insert_external_employee_failed", error.message);
        throw error;
      }
      inserted += 1;
    }
  }

  let deactivated = 0;
  if (externalIds.length > 0) {
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
