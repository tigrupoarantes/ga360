import { supabase } from "@/integrations/supabase/external-client";
import type { Database } from "@/integrations/supabase/types";

const SOURCE_SYSTEM = "dab_api";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 200;
const ENABLE_EMPLOYEE_DEACTIVATION = false;
// IMPORTANTE: Não usar delete+insert para sincronização completa.
// Isso destruiria o histórico (snapshots) e poderia distorcer análises históricas.
const ENABLE_FULL_REFRESH_REPLACE = false;
const INSERT_BATCH_SIZE = 500;

export interface EmployeesSyncProgress {
  stage:
    | "starting"
    | "fetching"
    | "fallback-pagination"
    | "preparing"
    | "clearing"
    | "inserting"
    | "finishing";
  message: string;
  page?: number;
  totalFetched?: number;
  inserted?: number;
  totalToInsert?: number;
}

interface EmployeesFetchDiagnostics {
  connectionId: string | null;
  pagesFetched: number;
  usedOffsetFallback: boolean;
  retriedWithoutConnection: boolean;
  retriedWithDefaultConnection: boolean;
  hadNextLink: boolean;
  firstPageCount: number;
}

type ExternalEmployeeInsert = Database["public"]["Tables"]["external_employees"]["Insert"];

export interface DabEmployee {
  id_funcionario: string;
  cpf: string | null;
  nome_funcionario: string;
  email?: string | null;
  sexo?: string | null;
  data_nascimento?: string | null;
  idade?: number | string | null;
  primeiro_emprego?: string | null;
  data_admissao: string | null;
  contabilizacao?: string | null;
  cargo?: string | null;
  categoria?: string | null;
  unidade?: string | null;
  departamento?: string | null;
  funcao?: string | null;
  cod_empresa?: number | null;
  cod_contabilizacao?: number | string | null;
  nome_fantasia?: string | null;
  data_demissao?: string | null;
  situacao_raw?: number | string | null;
}

interface DabEmployeeRaw {
  id_funcionario?: string | null;
  cpf?: string | null;
  nome_funcionario?: string | null;
  email?: string | null;
  sexo?: string | null;
  data_nascimento?: string | null;
  idade?: number | string | null;
  primeiro_emprego?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  contabilizacao?: string | null;
  cargo?: string | null;
  categoria?: string | null;
  unidade?: string | null;
  departamento?: string | null;
  funcao?: string | null;
  cod_empresa?: number | null;
  cod_contabilizacao?: number | string | null;
  nome_fantasia?: string | null;
  Situacao?: number | string | null;
  CPF?: string | null;
  Nome_Funcionario?: string | null;
  Email?: string | null;
  Sexo?: string | null;
  Data_Nascimento?: string | null;
  Idade?: number | string | null;
  Data_Admissao?: string | null;
  Data_Demissao?: string | null;
  Primeiro_Emprego?: string | null;
  Contabilizacao?: string | null;
  Cargo?: string | null;
  Categoria?: string | null;
  Departamento?: string | null;
  Funcao?: string | null;
  Cod_Empresa?: number | string | null;
  Cod_Contabilizacao?: number | string | null;
  Nome_Fantasia?: string | null;
}

interface NormalizedEmployeeResult {
  employee: DabEmployee | null;
  error?: string;
  maskedCpf: string;
}

function resolveUnit(employee: DabEmployee): string | null {
  return employee.categoria || employee.unidade || null;
}

const ACCOUNTING_CODE_TO_NAME: Record<string, string> = {
  "9": "CHOK AGRO",
  "3": "CHOK DISTRIBUIDORA",
  "4": "BROKER J. ARANTES",
  "5": "LOJAS CHOKDOCE",
  "8": "ESCRITORIO CENTRAL",
  "11": "G4 DISTRIBUIDORA",
};

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
  byAccountingGroupDescription: Map<string, string>;
  byExternalId: Map<string, string>;
  byAccountingGroupCode: Map<string, string>;
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

function normalizeLabel(value: string | null | undefined): string {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "";

  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeExternalCode(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCodeDigits(value: string | number | null | undefined): string {
  const raw = normalizeExternalCode(value);
  return raw.replace(/\D/g, "");
}

function resolveAccountingCode(employee: DabEmployee): string {
  const codeFromAccounting = normalizeCodeDigits(employee.cod_contabilizacao);
  if (codeFromAccounting) return codeFromAccounting;

  return "";
}

function resolveAccountingLabel(employee: DabEmployee): string | null {
  const accountingCode = resolveAccountingCode(employee);
  const labelByCode = accountingCode ? ACCOUNTING_CODE_TO_NAME[accountingCode] : undefined;
  if (labelByCode) return labelByCode;

  const labelFromApi = (employee.contabilizacao || "").trim();
  if (labelFromApi) return labelFromApi;

  return null;
}

function normalizeGender(value: string | null | undefined): string | null {
  const normalized = normalizeName(value).toUpperCase();
  if (!normalized) return null;

  if (normalized === "M" || normalized === "MASCULINO") return "MASCULINO";
  if (normalized === "F" || normalized === "FEMININO") return "FEMININO";
  if (normalized === "INDEFINIDO" || normalized === "NAO INFORMADO" || normalized === "NÃO INFORMADO") return "INDEFINIDO";

  return normalized;
}

function normalizeFirstJob(value: string | null | undefined): boolean | null {
  const normalized = normalizeName(value);
  if (!normalized) return null;

  if (["sim", "s", "true", "1"].includes(normalized)) return true;
  if (["nao", "não", "n", "false", "0"].includes(normalized)) return false;

  return null;
}

function normalizeInteger(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function normalizeSituacaoToIsActive(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "0" || normalized === "inativo" || normalized === "desligado") return false;
  if (normalized === "1" || normalized === "ativo") return true;

  return true;
}

function maskSensitiveForLog(value: string | null | undefined): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function normalizeFetchedEmployee(rawEmployee: DabEmployee | DabEmployeeRaw): NormalizedEmployeeResult {
  const raw = rawEmployee as DabEmployeeRaw;
  const cpf = normalizeDocument(raw.cpf ?? raw.CPF);
  const externalId = (raw.id_funcionario || cpf || "").trim();
  const fullName = (raw.nome_funcionario ?? raw.Nome_Funcionario ?? "").trim();

  if (!externalId) {
    return {
      employee: null,
      error: "Registro descartado: funcionário sem id_funcionario e sem CPF válido.",
      maskedCpf: maskSensitiveForLog(raw.cpf ?? raw.CPF),
    };
  }

  if (!fullName) {
    return {
      employee: null,
      error: "Registro descartado: funcionário sem nome.",
      maskedCpf: maskSensitiveForLog(raw.cpf ?? raw.CPF),
    };
  }

  return {
    employee: {
      id_funcionario: externalId,
      cpf,
      nome_funcionario: fullName,
      email: raw.email ?? raw.Email ?? null,
      sexo: raw.sexo ?? raw.Sexo ?? null,
      data_nascimento: raw.data_nascimento ?? raw.Data_Nascimento ?? null,
      idade: raw.idade ?? raw.Idade ?? null,
      primeiro_emprego: raw.primeiro_emprego ?? raw.Primeiro_Emprego ?? null,
      data_admissao: raw.data_admissao ?? raw.Data_Admissao ?? null,
      data_demissao: raw.data_demissao ?? raw.Data_Demissao ?? null,
      contabilizacao: raw.contabilizacao ?? raw.Contabilizacao ?? null,
      cargo: raw.cargo ?? raw.Cargo ?? null,
      categoria: raw.categoria ?? raw.Categoria ?? null,
      unidade: raw.unidade ?? null,
      departamento: raw.departamento ?? raw.Departamento ?? null,
      funcao: raw.funcao ?? raw.Funcao ?? null,
      cod_empresa: normalizeInteger(raw.cod_empresa ?? raw.Cod_Empresa),
      cod_contabilizacao: raw.cod_contabilizacao ?? raw.Cod_Contabilizacao ?? null,
      nome_fantasia: raw.nome_fantasia ?? raw.Nome_Fantasia ?? null,
      situacao_raw: raw.Situacao ?? null,
    },
    maskedCpf: maskSensitiveForLog(raw.cpf ?? raw.CPF),
  };
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
    .select("id, name, external_id, accounting_group_code, accounting_group_description");

  if (error) throw error;

  const byName = new Map<string, string>();
  const byAccountingGroupDescription = new Map<string, string>();
  const byExternalId = new Map<string, string>();
  const byAccountingGroupCode = new Map<string, string>();

  for (const company of data || []) {
    if (company.name) {
      const normalizedName = normalizeName(company.name);
      const normalizedLabel = normalizeLabel(company.name);
      if (normalizedName) byName.set(normalizedName, company.id);
      if (normalizedLabel) byName.set(normalizedLabel, company.id);
    }

    if (company.accounting_group_description) {
      const normalizedGroupDescription = normalizeLabel(company.accounting_group_description);
      if (normalizedGroupDescription) {
        byAccountingGroupDescription.set(normalizedGroupDescription, company.id);
      }
    }
    if (company.external_id) {
      byExternalId.set(normalizeExternalCode(company.external_id), company.id);
    }

    if (company.accounting_group_code) {
      const normalizedAccounting = normalizeCodeDigits(company.accounting_group_code);
      if (normalizedAccounting) {
        byAccountingGroupCode.set(normalizedAccounting, company.id);
      }
    }
  }

  return { byName, byAccountingGroupDescription, byExternalId, byAccountingGroupCode };
}

function resolveCompanyId(employee: DabEmployee, lookup: CompanyLookup): string | null {
  return resolveContractCompanyId(employee, lookup);
}

function resolveContractCompanyId(employee: DabEmployee, lookup: CompanyLookup): string | null {
  const byCompanyName = normalizeLabel(employee.nome_fantasia);
  if (byCompanyName && lookup.byName.has(byCompanyName)) {
    return lookup.byName.get(byCompanyName) || null;
  }

  const byAccountingCode = normalizeCodeDigits(employee.cod_empresa);
  if (byAccountingCode && lookup.byAccountingGroupCode.has(byAccountingCode)) {
    return lookup.byAccountingGroupCode.get(byAccountingCode) || null;
  }

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

function resolveAccountingCompanyId(employee: DabEmployee, lookup: CompanyLookup): string | null {
  const accountingCode = resolveAccountingCode(employee);
  const accountingLabelByCode = accountingCode ? ACCOUNTING_CODE_TO_NAME[accountingCode] : undefined;

  const byAccountingLabelCode = normalizeLabel(accountingLabelByCode);
  if (byAccountingLabelCode && lookup.byAccountingGroupDescription.has(byAccountingLabelCode)) {
    return lookup.byAccountingGroupDescription.get(byAccountingLabelCode) || null;
  }

  if (accountingCode && lookup.byAccountingGroupCode.has(accountingCode)) {
    return lookup.byAccountingGroupCode.get(accountingCode) || null;
  }

  const byAccountingDescription = normalizeLabel(employee.contabilizacao);
  if (byAccountingDescription && lookup.byAccountingGroupDescription.has(byAccountingDescription)) {
    return lookup.byAccountingGroupDescription.get(byAccountingDescription) || null;
  }

  return null;
}

async function callDabProxy(payload: {
  path?: string;
  query?: Record<string, string | number>;
  nextLink?: string;
  connectionId?: string;
  allPages?: boolean;
  maxPages?: number;
  logSync?: boolean;
  syncType?: string;
  companyId?: string | null;
}) {
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
      allPages: payload.allPages === true,
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

async function fetchFirstPageWithFallback(
  pageSize: number,
  connectionId?: string,
  options?: { preferExplicitLimit?: boolean },
): Promise<DabPageResponse> {
  const candidateSizes = [...new Set([pageSize, 50, 20, 10, 1].filter((value) => value > 0))];
  const candidateQueries: Array<Record<string, string | number> | undefined> = [];

  if (!options?.preferExplicitLimit) {
    candidateQueries.push(undefined);
  }

  for (const size of candidateSizes) {
    candidateQueries.push({ $first: size });
    candidateQueries.push({ first: size });
    candidateQueries.push({ $top: size });
    candidateQueries.push({ top: size });
    candidateQueries.push({ limit: size });
    candidateQueries.push({ pageSize: size });
    candidateQueries.push({ per_page: size });
    candidateQueries.push({ page_size: size });
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
  const candidates = [
    response?.value,
    response?.data,
    response?.items,
    response?.results,
    (response as any)?.funcionarios,
    (response as any)?.employees,
    (response as any)?.rows,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  const nestedData = (response as any)?.data;
  if (nestedData && typeof nestedData === "object") {
    const nestedCandidates = [
      nestedData.value,
      nestedData.items,
      nestedData.results,
      nestedData.funcionarios,
      nestedData.employees,
      nestedData.rows,
      nestedData.data,
    ];
    for (const candidate of nestedCandidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  const root = response as any;
  if (root && typeof root === "object") {
    const queue: any[] = [root];
    const seen = new Set<any>();
    let depth = 0;

    while (queue.length > 0 && depth < 4) {
      const levelSize = queue.length;
      for (let i = 0; i < levelSize; i++) {
        const node = queue.shift();
        if (!node || typeof node !== "object" || seen.has(node)) continue;
        seen.add(node);

        for (const [key, value] of Object.entries(node)) {
          if (Array.isArray(value) && /^(value|data|items|results|funcionarios|employees|rows)$/i.test(key)) {
            return value as DabEmployee[];
          }

          if (value && typeof value === "object") {
            queue.push(value);
          }
        }
      }
      depth += 1;
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
    (response as any)?.pagination?.next_page,
    (response as any)?.pagination?.next_page_url,
    (response as any)?.paging?.next,
    (response as any)?.paging?.nextLink,
    (response as any)?.links?.next,
    (response as any)?.links?.nextLink,
    (response as any)?.data?.next,
    (response as any)?.data?.nextLink,
    (response as any)?.data?.next_page,
    (response as any)?.data?.next_page_url,
    (response as any)?.meta?.next,
  ];

  for (const link of links) {
    if (typeof link === "string" && link.trim()) {
      return link.trim();
    }
  }

  const root = response as any;
  if (root && typeof root === "object") {
    const queue: any[] = [root];
    const seen = new Set<any>();
    let depth = 0;

    while (queue.length > 0 && depth < 5) {
      const levelSize = queue.length;
      for (let i = 0; i < levelSize; i++) {
        const node = queue.shift();
        if (!node || typeof node !== "object" || seen.has(node)) continue;
        seen.add(node);

        for (const [key, value] of Object.entries(node)) {
          if (typeof value === "string") {
            const lowerKey = key.toLowerCase();
            if (
              lowerKey.includes("next") &&
              (value.startsWith("http") || value.startsWith("/") || value.includes("skip") || value.includes("page"))
            ) {
              return value.trim();
            }
          }

          if (value && typeof value === "object") {
            queue.push(value);
          }
        }
      }
      depth += 1;
    }
  }

  return undefined;
}

async function fetchPageByOffsetWithFallback(
  pageSize: number,
  pageIndex: number,
  connectionId?: string,
): Promise<DabEmployee[]> {
  const offset = Math.max(0, (pageIndex - 1) * pageSize);
  const queryCandidates: Array<Record<string, string | number>> = [
    { $first: pageSize, $skip: offset },
    { first: pageSize, skip: offset },
    { $top: pageSize, $skip: offset },
    { top: pageSize, skip: offset },
    { take: pageSize, skip: offset },
    { maxResultCount: pageSize, skipCount: offset },
    { limit: pageSize, offset },
    { page: pageIndex, pageSize },
    { pageNumber: pageIndex, pageSize },
    { page: pageIndex, per_page: pageSize },
    { page: pageIndex, page_size: pageSize },
    { start: offset, count: pageSize },
    { pagina: pageIndex, pageSize },
    { pagina: pageIndex, tamanhoPagina: pageSize },
  ];

  let lastError: any = null;
  for (const query of queryCandidates) {
    try {
      const response = await callDabProxy({
        path: "funcionarios",
        query,
        ...(connectionId ? { connectionId } : {}),
      });
      const rows = extractPageEmployees(response);
      if (rows.length > 0) {
        return rows;
      }
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      if (status === 401 || status === 403) {
        throw error;
      }
    }
  }

  if (lastError) {
    trackEmployeesApiError(lastError?.status, "offset_pagination_failed", lastError?.details || lastError?.message);
  }

  return [];
}

export async function fetchEmployeesFromDab(
  pageSize = DEFAULT_PAGE_SIZE,
  onProgress?: (progress: EmployeesSyncProgress) => void,
  options?: { companyId?: string | null },
): Promise<{ employees: DabEmployee[]; diagnostics: EmployeesFetchDiagnostics }> {
  const employees: DabEmployee[] = [];
  let connectionId = await resolveEmployeesConnectionId();
  let nextLink: string | undefined;
  let pageCount = 0;
  const visitedNextLinks = new Set<string>();
  let retriedWithoutConnection = false;
  let usedOffsetFallback = false;
  let retriedWithDefaultConnection = false;
  let hadNextLink = false;
  let firstPageCount = 0;

  onProgress?.({
    stage: "fetching",
    message: "Conectando na API de funcionários...",
    page: 0,
    totalFetched: 0,
  });

  try {
    const aggregated = await callDabProxy({
      path: "funcionarios",
      allPages: true,
      maxPages: MAX_PAGES,
      connectionId,
      logSync: true,
      syncType: "employees_api",
      companyId: options?.companyId || null,
    });

    const aggregatedRows = extractPageEmployees(aggregated);
    const aggregatedMeta = (aggregated && typeof aggregated === "object" ? (aggregated as Record<string, unknown>).meta : {}) as Record<string, unknown>;
    const aggregatedPages = Number(aggregatedMeta.pages_fetched || 0);
    const aggregatedHadNext = Boolean(aggregatedMeta.had_next_link);

    if (aggregatedRows.length > 0) {
      onProgress?.({
        stage: "fetching",
        message: `Proxy allPages retornou ${aggregatedRows.length} funcionários em ${aggregatedPages || 1} página(s).`,
        page: aggregatedPages || 1,
        totalFetched: aggregatedRows.length,
      });

      // If it still looks like a single capped page (commonly 100 rows), don't trust it;
      // fall back to the legacy pagination flow.
      if (!(aggregatedRows.length === pageSize && aggregatedPages <= 1)) {
        return {
          employees: aggregatedRows,
          diagnostics: {
            connectionId: connectionId || null,
            pagesFetched: aggregatedPages || 1,
            usedOffsetFallback: false,
            retriedWithoutConnection: false,
            retriedWithDefaultConnection: false,
            hadNextLink: aggregatedHadNext,
            firstPageCount: aggregatedPages > 1 ? Math.min(pageSize, aggregatedRows.length) : aggregatedRows.length,
          },
        };
      }
    }
  } catch (error) {
    trackEmployeesApiError(undefined, "all_pages_proxy_failed_fallback_to_legacy", String(error));
  }

  do {
    let response: DabPageResponse;
    try {
      response = nextLink
        ? await callDabProxy({ nextLink, ...(connectionId ? { connectionId } : {}) })
        : await fetchFirstPageWithFallback(pageSize, connectionId);
    } catch (error: any) {
      const status = error?.status;
      if (status === 404 && connectionId && !retriedWithoutConnection) {
        retriedWithoutConnection = true;
        connectionId = undefined;
        nextLink = undefined;
        pageCount = 0;
        visitedNextLinks.clear();
        trackEmployeesApiError(status, "retry_without_connection_id", error?.details || error?.message);
        continue;
      }
      throw error;
    }

    const pageData = extractPageEmployees(response);
    if (pageCount === 0) {
      firstPageCount = pageData.length;
    }
    employees.push(...pageData);
    nextLink = extractNextLink(response);
    if (nextLink) hadNextLink = true;

    onProgress?.({
      stage: "fetching",
      message: `Lendo página ${pageCount + 1} da API... (${employees.length} funcionários acumulados)`,
      page: pageCount + 1,
      totalFetched: employees.length,
    });

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

    // Alguns backends retornam 100 itens sem nextLink. Primeiro, tenta ampliar o limite por query.
    if (!nextLink && pageData.length >= pageSize && !usedOffsetFallback) {
      const expandedPageSize = Math.max(pageSize * 20, 1000);
      const expandedResponse = await fetchFirstPageWithFallback(expandedPageSize, connectionId, {
        preferExplicitLimit: true,
      }).catch(() => null);

      const expandedRows = expandedResponse ? extractPageEmployees(expandedResponse) : [];
      if (expandedRows.length > employees.length) {
        employees.length = 0;
        employees.push(...expandedRows);
        nextLink = extractNextLink(expandedResponse as DabPageResponse);

        onProgress?.({
          stage: "fetching",
          message: `API sem nextLink. Limite ampliado para ${employees.length} funcionários na primeira leitura.`,
          page: pageCount,
          totalFetched: employees.length,
        });

        if (nextLink) {
          continue;
        }
      }

      // Se ainda não houver nextLink, tenta fallback por offset/página.
      usedOffsetFallback = true;

      onProgress?.({
        stage: "fallback-pagination",
        message: "API sem nextLink. Tentando paginação alternativa por offset/página...",
        page: 1,
        totalFetched: employees.length,
      });

      const seenIds = new Set<string>(
        employees
          .map((item) => item.id_funcionario)
          .filter((value): value is string => Boolean(value)),
      );

      let totalAddedByFallback = 0;
      for (let fallbackPage = 2; fallbackPage <= MAX_PAGES; fallbackPage++) {
        const rows = await fetchPageByOffsetWithFallback(pageSize, fallbackPage, connectionId);
        if (!rows.length) {
          break;
        }

        let added = 0;
        for (const row of rows) {
          const key = row.id_funcionario || `${row.cpf || ""}|${row.nome_funcionario || ""}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          employees.push(row);
          added += 1;
        }

        totalAddedByFallback += added;

        // Se nenhuma linha nova entrou, endpoint não aceitou paginação por offset.
        if (added === 0) {
          break;
        }

        onProgress?.({
          stage: "fallback-pagination",
          message: `Paginação alternativa: página ${fallbackPage} (${employees.length} funcionários acumulados)`,
          page: fallbackPage,
          totalFetched: employees.length,
        });
      }

      // Se continuou travado no primeiro bloco (ex.: conexão selecionada parcial),
      // refaz fluxo com a conexão padrão do proxy (sem connectionId explícito).
      if (totalAddedByFallback === 0 && connectionId && !retriedWithDefaultConnection) {
        retriedWithDefaultConnection = true;
        connectionId = undefined;
        nextLink = undefined;
        pageCount = 0;
        usedOffsetFallback = false;
        retriedWithoutConnection = false;
        visitedNextLinks.clear();
        employees.length = 0;

        onProgress?.({
          stage: "fallback-pagination",
          message: "Conexão atual parece limitada. Repetindo sincronização com conexão padrão do proxy...",
          page: 1,
          totalFetched: 0,
        });

        continue;
      }

      break;
    }
  } while (nextLink);

  return {
    employees,
    diagnostics: {
      connectionId: connectionId || null,
      pagesFetched: pageCount,
      usedOffsetFallback,
      retriedWithoutConnection,
      retriedWithDefaultConnection,
      hadNextLink,
      firstPageCount,
    },
  };
}

async function startEmployeesSyncLog(args: {
  companyId: string | null;
  recordsReceived: number;
  diagnostics?: Record<string, unknown>;
}): Promise<string | null> {
  if (!args.companyId) return null;

  try {
    const { data, error } = await supabase
      .from("sync_logs")
      .insert({
        company_id: args.companyId,
        sync_type: "employees_api",
        records_received: args.recordsReceived,
        status: "running",
        started_at: new Date().toISOString(),
        errors: args.diagnostics || null,
      })
      .select("id")
      .single();

    if (error) {
      trackEmployeesApiError(undefined, "sync_log_start_failed", error.message);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    trackEmployeesApiError(undefined, "sync_log_start_exception", String(error));
    return null;
  }
}

async function finishEmployeesSyncLog(args: {
  syncLogId: string | null;
  status: "success" | "partial" | "error";
  created: number;
  updated: number;
  failed: number;
  recordsReceived: number;
  errors?: unknown;
}) {
  if (!args.syncLogId) return;

  try {
    const { error } = await supabase
      .from("sync_logs")
      .update({
        status: args.status,
        records_created: args.created,
        records_updated: args.updated,
        records_failed: args.failed,
        records_received: args.recordsReceived,
        completed_at: new Date().toISOString(),
        errors: args.errors ?? null,
      })
      .eq("id", args.syncLogId);

    if (error) {
      trackEmployeesApiError(undefined, "sync_log_finish_failed", error.message);
    }
  } catch (error) {
    trackEmployeesApiError(undefined, "sync_log_finish_exception", String(error));
  }
}

export async function syncEmployeesFromDab(
  options?: { onProgress?: (progress: EmployeesSyncProgress) => void; companyId?: string | null },
): Promise<{ inserted: number; updated: number; deactivated: number; totalFetched: number }> {
  const onProgress = options?.onProgress;

  onProgress?.({
    stage: "starting",
    message: "Iniciando sincronização de funcionários...",
  });

  const [{ employees: fetchedEmployees, diagnostics }, companyLookup] = await Promise.all([
    fetchEmployeesFromDab(DEFAULT_PAGE_SIZE, onProgress, { companyId: options?.companyId || null }),
    fetchCompaniesLookup(),
  ]);

  let syncLogCompanyId = options?.companyId || null;
  let syncLogId: string | null = null;
  const normalizedEmployees: DabEmployee[] = [];
  const normalizationErrors: Array<{ employee: string | null; reason: string }> = [];

  for (const fetchedEmployee of fetchedEmployees) {
    const normalizedResult = normalizeFetchedEmployee(fetchedEmployee);
    if (normalizedResult.employee) {
      normalizedEmployees.push(normalizedResult.employee);
      continue;
    }

    normalizationErrors.push({
      employee: normalizedResult.maskedCpf,
      reason: normalizedResult.error || "unknown_error",
    });
  }

  if (normalizedEmployees.length === 0) {
    throw new Error(
      `Nenhum funcionario valido foi normalizado a partir do payload da API. ${JSON.stringify({
        total_fetched: fetchedEmployees.length,
        discarded_records: normalizationErrors.length,
        normalization_errors: normalizationErrors,
        pages_fetched: diagnostics.pagesFetched,
        first_page_count: diagnostics.firstPageCount,
        had_next_link: diagnostics.hadNextLink,
        used_offset_fallback: diagnostics.usedOffsetFallback,
        retried_without_connection: diagnostics.retriedWithoutConnection,
        retried_default_connection: diagnostics.retriedWithDefaultConnection,
        connection_id: diagnostics.connectionId,
      })}`,
    );
  }

  onProgress?.({
    stage: "preparing",
    message: `Preparando payload de ${fetchedEmployees.length} funcionários...`,
    totalFetched: fetchedEmployees.length,
  });

  if (ENABLE_FULL_REFRESH_REPLACE) {
    if (!Array.isArray(fetchedEmployees) || fetchedEmployees.length === 0) {
      throw new Error("A API retornou 0 funcionários. Limpeza cancelada para evitar apagar dados existentes.");
    }

    const uniquePayloadByKey = new Map<string, ExternalEmployeeInsert>();
    let companyResolvedCount = 0;
    let companyUnresolvedCount = 0;

    for (const employee of normalizedEmployees) {
      const resolvedContractCompanyId = resolveContractCompanyId(employee, companyLookup);
      const resolvedAccountingCompanyId = resolveAccountingCompanyId(employee, companyLookup);
      const contractCompanyId = resolvedContractCompanyId || options?.companyId || null;
      const accountingCompanyId = resolvedAccountingCompanyId || null;
      const accountingLabel = resolveAccountingLabel(employee);
      const accountingCode = resolveAccountingCode(employee);
      const uniqueKey = buildEmployeeUniqueKey(contractCompanyId, employee.id_funcionario);
      const terminationDate = normalizeDate(employee.data_demissao) || null;
      const isActive = terminationDate ? false : normalizeSituacaoToIsActive(employee.situacao_raw);

      if (contractCompanyId) {
        companyResolvedCount += 1;
      } else {
        companyUnresolvedCount += 1;
      }

      uniquePayloadByKey.set(uniqueKey, {
        external_id: employee.id_funcionario,
        source_system: SOURCE_SYSTEM,
        full_name: employee.nome_funcionario,
        email: employee.email || null,
        accounting_group: accountingLabel,
        cpf: normalizeDocument(employee.cpf),
        registration_number: normalizeDocument(employee.cpf),
        birth_date: normalizeDate(employee.data_nascimento),
        gender: normalizeGender(employee.sexo),
        age: normalizeInteger(employee.idade),
        first_job: normalizeFirstJob(employee.primeiro_emprego),
        hire_date: normalizeDate(employee.data_admissao),
        termination_date: terminationDate,
        position: employee.cargo || null,
        unidade: resolveUnit(employee),
        department: employee.departamento || null,
        metadata: {
          function_name: employee.funcao || null,
          company_code: employee.cod_empresa ?? null,
          company_name: employee.nome_fantasia || null,
          contabilizacao: accountingLabel,
          contabilizacao_raw: employee.contabilizacao || null,
          cod_contabilizacao: accountingCode || null,
          categoria: employee.categoria || null,
          sexo_raw: employee.sexo || null,
          primeiro_emprego_raw: employee.primeiro_emprego || null,
          dismissal_date: normalizeDate(employee.data_demissao),
          situacao_raw: employee.situacao_raw ?? null,
          contract_company_id: contractCompanyId,
          accounting_company_id: accountingCompanyId,
          cpf_masked: maskSensitiveForLog(employee.cpf),
        },
        contract_company_id: contractCompanyId,
        accounting_company_id: accountingCompanyId,
        company_id: contractCompanyId,
        is_active: isActive,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const payloadRows: ExternalEmployeeInsert[] = [...uniquePayloadByKey.values()];

    if (!syncLogCompanyId) {
      syncLogCompanyId = (payloadRows.find((row) => Boolean(row.company_id))?.company_id as string | null) || null;
    }

    syncLogId = await startEmployeesSyncLog({
      companyId: syncLogCompanyId,
      recordsReceived: fetchedEmployees.length,
      diagnostics: {
        phase: "full_refresh",
        normalized_records: normalizedEmployees.length,
        discarded_records: normalizationErrors.length,
        company_resolved_records: companyResolvedCount,
        company_unresolved_records: companyUnresolvedCount,
        normalization_errors: normalizationErrors,
        pages_fetched: diagnostics.pagesFetched,
        first_page_count: diagnostics.firstPageCount,
        had_next_link: diagnostics.hadNextLink,
        used_offset_fallback: diagnostics.usedOffsetFallback,
        retried_without_connection: diagnostics.retriedWithoutConnection,
        retried_default_connection: diagnostics.retriedWithDefaultConnection,
        connection_id: diagnostics.connectionId,
      },
    });

    onProgress?.({
      stage: "clearing",
      message: "Limpando base atual para carga completa...",
      totalFetched: fetchedEmployees.length,
      totalToInsert: payloadRows.length,
    });

    const { error: clearError } = await supabase
      .from("external_employees")
      .delete()
      .eq("source_system", SOURCE_SYSTEM);

    if (clearError) {
      throw new Error(`Falha ao limpar funcionários atuais: ${clearError.message}`);
    }

    let inserted = 0;
    onProgress?.({
      stage: "inserting",
      message: `Inserindo ${payloadRows.length} funcionários em lotes...`,
      totalFetched: fetchedEmployees.length,
      inserted,
      totalToInsert: payloadRows.length,
    });

    for (let index = 0; index < payloadRows.length; index += INSERT_BATCH_SIZE) {
      const batch = payloadRows.slice(index, index + INSERT_BATCH_SIZE);
      const { error } = await supabase.from("external_employees").insert(batch);

      if (error) {
        const detailedMessage = [error.message, (error as any).details, (error as any).hint].filter(Boolean).join(" | ");
        throw new Error(`Falha ao inserir lote da sincronização: ${detailedMessage || error.message}`);
      }

      inserted += batch.length;
      onProgress?.({
        stage: "inserting",
        message: `Inserindo lotes... ${inserted}/${payloadRows.length}`,
        totalFetched: fetchedEmployees.length,
        inserted,
        totalToInsert: payloadRows.length,
      });
    }

    onProgress?.({
      stage: "finishing",
      message: `Concluído: ${inserted} inseridos (${fetchedEmployees.length} lidos da API).`,
      totalFetched: fetchedEmployees.length,
      inserted,
      totalToInsert: payloadRows.length,
    });

    await finishEmployeesSyncLog({
      syncLogId,
      status: "success",
      created: inserted,
      updated: 0,
      failed: normalizationErrors.length,
      recordsReceived: fetchedEmployees.length,
      errors: {
        phase: "full_refresh",
        normalized_records: normalizedEmployees.length,
        discarded_records: normalizationErrors.length,
        company_resolved_records: companyResolvedCount,
        company_unresolved_records: companyUnresolvedCount,
        normalization_errors: normalizationErrors,
        pages_fetched: diagnostics.pagesFetched,
        first_page_count: diagnostics.firstPageCount,
        had_next_link: diagnostics.hadNextLink,
        used_offset_fallback: diagnostics.usedOffsetFallback,
        retried_without_connection: diagnostics.retriedWithoutConnection,
        retried_default_connection: diagnostics.retriedWithDefaultConnection,
        connection_id: diagnostics.connectionId,
      },
    });

    return {
      inserted,
      updated: 0,
      deactivated: 0,
      totalFetched: fetchedEmployees.length,
    };
  }

  const fetchedUniqueKeys = new Set<string>();

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
  let companyResolvedCount = 0;
  let companyUnresolvedCount = 0;

  if (!syncLogCompanyId) {
    syncLogCompanyId = options?.companyId || null;
  }

  syncLogId = await startEmployeesSyncLog({
    companyId: syncLogCompanyId,
    recordsReceived: fetchedEmployees.length,
    diagnostics: {
      phase: "incremental",
      normalized_records: normalizedEmployees.length,
      discarded_records: normalizationErrors.length,
      normalization_errors: normalizationErrors,
      pages_fetched: diagnostics.pagesFetched,
      first_page_count: diagnostics.firstPageCount,
      had_next_link: diagnostics.hadNextLink,
      used_offset_fallback: diagnostics.usedOffsetFallback,
      retried_without_connection: diagnostics.retriedWithoutConnection,
      retried_default_connection: diagnostics.retriedWithDefaultConnection,
      connection_id: diagnostics.connectionId,
    },
  });

  for (const employee of normalizedEmployees) {
    const contractCompanyId = resolveContractCompanyId(employee, companyLookup) || options?.companyId || null;
    const accountingCompanyId = resolveAccountingCompanyId(employee, companyLookup);
    const accountingLabel = resolveAccountingLabel(employee);
    const accountingCode = resolveAccountingCode(employee);
    const terminationDate = normalizeDate(employee.data_demissao) || null;
    const isActive = terminationDate ? false : normalizeSituacaoToIsActive(employee.situacao_raw);

    if (contractCompanyId) {
      companyResolvedCount += 1;
    } else {
      companyUnresolvedCount += 1;
    }

    const payload: ExternalEmployeeInsert = {
      external_id: employee.id_funcionario,
      source_system: SOURCE_SYSTEM,
      full_name: employee.nome_funcionario,
      email: employee.email || null,
      accounting_group: accountingLabel,
      cpf: normalizeDocument(employee.cpf),
      registration_number: normalizeDocument(employee.cpf),
      birth_date: normalizeDate(employee.data_nascimento),
      gender: normalizeGender(employee.sexo),
      age: normalizeInteger(employee.idade),
      first_job: normalizeFirstJob(employee.primeiro_emprego),
      hire_date: normalizeDate(employee.data_admissao),
      termination_date: terminationDate,
      position: employee.cargo || null,
      unidade: resolveUnit(employee),
      department: employee.departamento || null,
      metadata: {
        function_name: employee.funcao || null,
        company_code: employee.cod_empresa ?? null,
        company_name: employee.nome_fantasia || null,
        contabilizacao: accountingLabel,
        contabilizacao_raw: employee.contabilizacao || null,
        cod_contabilizacao: accountingCode || null,
        categoria: employee.categoria || null,
        sexo_raw: employee.sexo || null,
        primeiro_emprego_raw: employee.primeiro_emprego || null,
        dismissal_date: normalizeDate(employee.data_demissao),
        situacao_raw: employee.situacao_raw ?? null,
        contract_company_id: contractCompanyId,
        accounting_company_id: accountingCompanyId,
        cpf_masked: maskSensitiveForLog(employee.cpf),
      },
      contract_company_id: contractCompanyId,
      accounting_company_id: accountingCompanyId,
      company_id: contractCompanyId,
      is_active: isActive,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const uniqueKey = buildEmployeeUniqueKey(contractCompanyId, employee.id_funcionario);
    fetchedUniqueKeys.add(uniqueKey);
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

          conflictQuery = contractCompanyId === null
            ? conflictQuery.is("company_id", null)
            : conflictQuery.eq("company_id", contractCompanyId);

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

      insertedRowQuery = contractCompanyId === null
        ? insertedRowQuery.is("company_id", null)
        : insertedRowQuery.eq("company_id", contractCompanyId);

      const { data: insertedRow } = await insertedRowQuery.maybeSingle();

      if (insertedRow?.id) {
        existingByUniqueKey.set(uniqueKey, insertedRow.id);
      }
    }
  }

  let deactivated = 0;
  if (ENABLE_EMPLOYEE_DEACTIVATION && fetchedUniqueKeys.size > 0) {
    const { data: currentlyActive, error: activeError } = await supabase
      .from("external_employees")
      .select("id, external_id, company_id")
      .eq("source_system", SOURCE_SYSTEM)
      .eq("is_active", true);

    if (activeError) throw activeError;

    const toDeactivateIds = (currentlyActive || [])
      .filter((row) => !fetchedUniqueKeys.has(buildEmployeeUniqueKey(row.company_id, row.external_id)))
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

  await finishEmployeesSyncLog({
    syncLogId,
    status: "success",
    created: inserted,
    updated,
    failed: normalizationErrors.length,
    recordsReceived: fetchedEmployees.length,
    errors: {
      phase: "incremental",
      normalized_records: normalizedEmployees.length,
      discarded_records: normalizationErrors.length,
      company_resolved_records: companyResolvedCount,
      company_unresolved_records: companyUnresolvedCount,
      normalization_errors: normalizationErrors,
      pages_fetched: diagnostics.pagesFetched,
      first_page_count: diagnostics.firstPageCount,
      had_next_link: diagnostics.hadNextLink,
      used_offset_fallback: diagnostics.usedOffsetFallback,
      retried_without_connection: diagnostics.retriedWithoutConnection,
      retried_default_connection: diagnostics.retriedWithDefaultConnection,
      connection_id: diagnostics.connectionId,
    },
  });

  return {
    inserted,
    updated,
    deactivated,
    totalFetched: fetchedEmployees.length,
  };
}
