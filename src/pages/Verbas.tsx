import { useMemo, useState, useEffect, type ReactNode } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert, Search, EyeOff, Eye, RefreshCw, ChevronDown,
  Building2, Briefcase, Users, DollarSign, TrendingUp, TrendingDown,
  Minus, Settings2, PieChart, Table2, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerbasAccess = "full" | "masked";

interface VerbasRow {
  company_id: string;
  razao_social: string;
  cpf: string;
  nome_funcionario: string;
  employee_department?: string | null;
  employee_unit?: string | null;
  employee_position?: string | null;
  employee_accounting_group?: string | null;
  compare_group_key?: string | null;
  tipo_verba: string;
  ano: number;
  janeiro: number | null;
  fevereiro: number | null;
  marco: number | null;
  abril: number | null;
  maio: number | null;
  junho: number | null;
  julho: number | null;
  agosto: number | null;
  setembro: number | null;
  outubro: number | null;
  novembro: number | null;
  dezembro: number | null;
  masked?: boolean;
}

interface VerbasResponse {
  success: boolean;
  access: VerbasAccess;
  page: number;
  pageSize: number;
  total: number;
  sync_warning?: string;
  sync_error?: string;
  sync_result?: {
    received?: number;
    processed?: number;
    failed?: number;
    upserted?: number;
    duration_ms?: number;
    source_system?: string;
    job_id?: string;
    failure_reasons?: Array<{ reason?: string; count?: number }>;
  };
  rows: VerbasRow[];
}

interface VerbasSyncJob {
  id: string;
  ano: number;
  mes: number | null;
  status: "queued" | "running" | "done" | "error";
  pages_fetched: number;
  records_received: number;
  records_upserted: number;
  records_failed: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Hierarchy node types ─────────────────────────────────────────────────────

type MonthMap = Record<typeof MONTH_COLUMNS[number], number>;

interface TableRow {
  companyId: string;
  razaoSocial: string;
  cpf: string;
  nome: string;
  cargo: string;
  setor: string;
  grupoContabil: string;
  months: MonthMap;
  total: number;
}

interface TipoNode {
  tipo: string;
  total: number;
  yearsMap: Map<number, MonthMap>;
}

interface EmployeeNode {
  key: string;
  companyId: string;
  razaoSocial: string;
  department: string;
  unit: string;
  position: string;
  accountingGroup: string;
  compareGroupKey: string;
  cpf: string;
  nome: string;
  total: number;
  tipos: TipoNode[];
}

interface PositionNode {
  position: string;
  total: number;
  employeeCount: number;
  avgPerEmployee: number;
  employees: EmployeeNode[];
}

interface AccountingGroupNode {
  accountingGroup: string;
  total: number;
  employeeCount: number;
  positionNodes: PositionNode[];
}

interface CompanyNode {
  companyId: string;
  razaoSocial: string;
  total: number;
  employeeCount: number;
  accountingGroupNodes: AccountingGroupNode[];
}

interface AccountingRootNode {
  accountingGroup: string;
  total: number;
  employeeCount: number;
  companyCount: number;
  positionNodes: PositionNode[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_COLUMNS = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

const MONTH_LABELS: Record<typeof MONTH_COLUMNS[number], string> = {
  janeiro: "Jan", fevereiro: "Fev", marco: "Mar", abril: "Abr",
  maio: "Mai", junho: "Jun", julho: "Jul", agosto: "Ago",
  setembro: "Set", outubro: "Out", novembro: "Nov", dezembro: "Dez",
};

const TIPO_VERBA_OPTIONS = [
  "SALDO_SALARIO", "COMISSAO_DSR", "BONUS", "PREMIO",
  "VERBA_INDENIZATORIA", "ADIANTAMENTO_VERBA_IDENIZATORIA",
  "DESC_PLANO_SAUDE", "PLANO_SAUDE_EMPRESA", "FGTS", "OUTROS",
];

const TIPO_VERBA_LABELS: Record<string, string> = {
  SALDO_SALARIO: "Saldo de Salário",
  COMISSAO_DSR: "Comissão + DSR",
  BONUS: "Bônus",
  PREMIO: "Prêmio",
  VERBA_INDENIZATORIA: "Verba Indenizatória",
  ADIANTAMENTO_VERBA_IDENIZATORIA: "Adiant. Verba Indenizatória",
  DESC_PLANO_SAUDE: "Desc. Plano de Saúde",
  PLANO_SAUDE_EMPRESA: "Plano de Saúde (Empresa)",
  FGTS: "FGTS",
  OUTROS: "Outros",
};

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (compact && Math.abs(n) >= 1_000_000)
    return `R$\u00a0${(n / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (compact && Math.abs(n) >= 1_000)
    return `R$\u00a0${(n / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

async function extractInvokeErrorDetails(invokeError: any): Promise<string> {
  let details = String(invokeError?.message || "Falha ao executar função");

  const context = invokeError?.context;
  if (!context) return details;

  try {
    const contentType = String(context.headers?.get?.("content-type") || "").toLowerCase();
    const text = await context.text().catch(() => "");
    if (!text) return details;

    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        return String(json?.error || json?.message || text || details);
      } catch {
        return text;
      }
    }

    // Sometimes Supabase returns plain text or invalid JSON.
    try {
      const json = JSON.parse(text);
      return String(json?.error || json?.message || text || details);
    } catch {
      return text;
    }
  } catch {
    return details;
  }
}

function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "***.***.***-**";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return "***.***.***-**";
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

// ─── Delta badge (above/below role average) ───────────────────────────────────

function DeltaBadge({ value, avg }: { value: number; avg: number }) {
  if (avg === 0) return null;
  const delta = value - avg;
  const pct = (delta / Math.abs(avg)) * 100;
  const isAbove = delta > 0;
  const isNeutral = Math.abs(pct) < 1;
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 tabular-nums text-xs",
        isNeutral
          ? "text-muted-foreground"
          : isAbove
          ? "border-emerald-500 text-emerald-600"
          : "border-rose-500 text-rose-600",
      )}
    >
      {isNeutral ? (
        <Minus className="h-3 w-3 mr-1 inline" />
      ) : isAbove ? (
        <TrendingUp className="h-3 w-3 mr-1 inline" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-1 inline" />
      )}
      {formatPercentage(pct)} vs média do cargo
    </Badge>
  );
}

// ─── Employee tipo accordion with line chart ──────────────────────────────────

function EmployeeTiposAccordion({
  tipos,
  employeeKey,
  selectedYears,
}: {
  tipos: TipoNode[];
  employeeKey: string;
  selectedYears: string[];
}) {
  return (
    <Accordion type="multiple" className="w-full border-l-2 border-border pl-4 mt-2">
      {tipos.map((tipoNode) => {
        const years = [...tipoNode.yearsMap.keys()].sort((a, b) => b - a);
        const chartData = MONTH_COLUMNS.map((month, idx) => {
          const point: Record<string, string | number | null> = { m: MONTH_LABELS[month] };
          for (const year of years) {
            const mm = tipoNode.yearsMap.get(year);
            const cur = Number(mm?.[month] || 0);
            point[`v_${year}`] = cur;
            if (idx === 0) {
              point[`p_${year}`] = null;
            } else {
              const prev = Number(mm?.[MONTH_COLUMNS[idx - 1]] || 0);
              point[`p_${year}`] = prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
            }
          }
          return point;
        });
        return (
          <AccordionItem
            key={`${employeeKey}-${tipoNode.tipo}`}
            value={`${employeeKey}-${tipoNode.tipo}`}
            className="border-b-0"
          >
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex flex-1 items-center justify-between gap-3 text-left pr-2">
                <span className="text-sm font-medium text-muted-foreground">{tipoNode.tipo}</span>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {formatCurrency(tipoNode.total)}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                      <YAxis
                        yAxisId="v"
                        tickFormatter={(v) =>
                          Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                        }
                        tick={{ fontSize: 10 }}
                        width={80}
                      />
                      <YAxis
                        yAxisId="p"
                        orientation="right"
                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                        tick={{ fontSize: 10 }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(value, name) => {
                          const k = String(name);
                          if (k.startsWith("v_")) return [formatCurrency(Number(value)), `Valor ${k.slice(2)}`];
                          if (k.startsWith("p_")) return [formatPercentage(Number(value)), `Var % ${k.slice(2)}`];
                          return [String(value), k];
                        }}
                      />
                      {years.map((year, i) => (
                        <Line
                          key={`v_${year}`}
                          yAxisId="v"
                          type="monotone"
                          dataKey={`v_${year}`}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ fill: CHART_COLORS[i % CHART_COLORS.length], r: 3 }}
                          name={`v_${year}`}
                        />
                      ))}
                      {years.map((year, i) => (
                        <Line
                          key={`p_${year}`}
                          yAxisId="p"
                          type="monotone"
                          dataKey={`p_${year}`}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                          connectNulls={false}
                          name={`p_${year}`}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {years.map((year) => {
                    const mm = tipoNode.yearsMap.get(year);
                    const vals = MONTH_COLUMNS.map((m) => Number(mm?.[m] || 0));
                    const nz = vals.map((v, idx) => ({ v, idx })).filter((e) => e.v !== 0);
                    const first = nz[0]; const last = nz[nz.length - 1];
                    if (!first || !last) return null;
                    const gv = last.v - first.v;
                    const gp = first.v === 0 ? null : ((last.v - first.v) / Math.abs(first.v)) * 100;
                    return (
                      <Badge key={year} variant="outline" className="text-xs tabular-nums">
                        {year} · {MONTH_LABELS[MONTH_COLUMNS[first.idx]]}→{MONTH_LABELS[MONTH_COLUMNS[last.idx]]} · {formatCurrency(gv, true)} ({formatPercentage(gp)})
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export default function VerbasPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const hasFullAccess = ["super_admin", "ceo", "diretor"].includes(role ?? "");
  const currentYear = new Date().getFullYear();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [selectedYears, setSelectedYears] = useState<string[]>([String(currentYear)]);
  // Inputs controlados (o que o usuário digita)
  const [cpfInput, setCpfInput] = useState("");
  const [nomeInput, setNomeInput] = useState("");
  // Valores debounced (entram no queryKey, disparam fetch após 400ms)
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [tipoVerba, setTipoVerba] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "company" | "accounting">("table");
  const [sortKey, setSortKey] = useState<"nome" | "empresa" | "total">("empresa");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  // ── Sync state ────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [closingMonth, setClosingMonth] = useState(String(new Date().getMonth() + 1));
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; stepLabel: string; modeLabel: string } | null>(null);
  const [syncSummary, setSyncSummary] = useState<VerbasResponse["sync_result"] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [syncChecklist, setSyncChecklist] = useState<Array<{ label: string; ok: boolean }>>([]);

  // ── Job polling state ─────────────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<VerbasSyncJob | null>(null);

  // ── Preview state ─────────────────────────────────────────────────────────
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    distinct_cpfs_in_source: number;
    cpfs_matched: number;
    cpfs_sem_empresa: number;
    sem_empresa_records: Array<{ cpf: string; nome: string }>;
    cpfs_not_found: number;
    received: number;
    failed: number;
  } | null>(null);

  // ── Recalcular associações (apply_payroll_staging) ─────────────────────────
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ staging_rows: number; inserted_or_updated: number; cpfs_sem_empresa: number } | null>(null);

  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("verbas_sync_jobs")
        .select("*")
        .eq("id", activeJobId)
        .single();
      if (data) setJobStatus(data as VerbasSyncJob);
      if (data?.status === "done" || data?.status === "error") {
        clearInterval(interval);
        setActiveJobId(null);
        setSyncing(false);
        void refetch().catch(() => null);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce text inputs — só atualiza queryKey 400ms após parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setCpf(cpfInput.replace(/\D/g, "")), 400);
    return () => clearTimeout(t);
  }, [cpfInput]);
  useEffect(() => {
    const t = setTimeout(() => setNome(nomeInput), 400);
    return () => clearTimeout(t);
  }, [nomeInput]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (let year = currentYear; year >= currentYear - 5; year--) {
      years.add(String(year));
    }
    for (const year of selectedYears) years.add(year);
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [currentYear, selectedYears]);

  const yearsLabel = useMemo(() => {
    if (selectedYears.length === 0) return "Selecionar";
    if (selectedYears.length === 1) return selectedYears[0];
    return `${selectedYears.length} anos`;
  }, [selectedYears]);

  const toggleYear = (year: string) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== year);
      }
      return [...prev, year].sort((a, b) => Number(b) - Number(a));
    });
  };

  // Lista estática de empresas — carregada independentemente dos dados de verbas
  // para evitar o problema de loop: filtrar por empresa → dropdown só tem 1 opção
  const { data: companiesList } = useQuery({
    queryKey: ["companies-list-verbas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
  });

  // ── Histórico de syncs recentes (verbas_sync_jobs) ─────────────────────────
  const { data: recentJobs } = useQuery({
    queryKey: ["verbas-sync-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("verbas_sync_jobs")
        .select("id, ano, mes, status, records_received, records_upserted, records_failed, error_message, started_at, completed_at, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as VerbasSyncJob[];
    },
    refetchInterval: syncing ? 5000 : false,
    staleTime: 30_000,
  });

  const lastSuccessfulSync = useMemo(() => {
    return recentJobs?.find((j) => j.status === "done" && j.records_received > 0) ?? null;
  }, [recentJobs]);

  // Query direta ao banco — sem edge function — para máxima performance no carregamento.
  // A edge function verbas-secure-query é chamada APENAS para operações de sync/preview.
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [
      "verbas-pivot-direct",
      selectedYears.join(","),
      cpf, nome, tipoVerba,
      companyFilter, positionFilter, departmentFilter,
    ],
    queryFn: async () => {
      const yearsToQuery = selectedYears.length ? selectedYears : [String(currentYear)];
      const allRows: VerbasRow[] = [];
      // PostgREST can cap each response below the requested range.
      // We page using the effective safe ceiling and keep fetching until no rows remain.
      const batchSize = 1000;

      for (const year of yearsToQuery) {
        for (let batch = 0; ; batch += 1) {
          const from = batch * batchSize;
          const to = from + batchSize - 1;

          let q = supabase
            .from("payroll_verba_pivot")
            .select("*")
            .eq("ano", Number(year))
            .range(from, to);

          if (companyFilter !== "all") q = q.eq("company_id", companyFilter);
          if (cpf.trim()) q = q.ilike("cpf", `%${cpf.trim().replace(/\D/g, "")}%`);
          if (nome.trim()) q = q.ilike("nome_funcionario", `%${nome.trim()}%`);
          if (tipoVerba !== "all") q = q.eq("tipo_verba", tipoVerba);
          if (departmentFilter !== "all") q = q.eq("employee_department", departmentFilter);
          if (positionFilter !== "all") q = q.eq("employee_position", positionFilter);

          const { data: rows, error: qErr } = await q;
          if (qErr) throw new Error(qErr.message);

          for (const row of rows || []) {
            allRows.push({
              company_id: row.company_id,
              razao_social: row.razao_social,
              cpf: hasFullAccess ? row.cpf : maskCpf(row.cpf),
              nome_funcionario: row.nome_funcionario,
              employee_department: row.employee_department ?? null,
              employee_unit: row.employee_unidade ?? null,
              employee_position: row.employee_position ?? null,
              employee_accounting_group: row.employee_accounting_group ?? null,
              compare_group_key: null,
              tipo_verba: row.tipo_verba,
              ano: row.ano,
              janeiro: row.janeiro,
              fevereiro: row.fevereiro,
              marco: row.marco,
              abril: row.abril,
              maio: row.maio,
              junho: row.junho,
              julho: row.julho,
              agosto: row.agosto,
              setembro: row.setembro,
              outubro: row.outubro,
              novembro: row.novembro,
              dezembro: row.dezembro,
              masked: !hasFullAccess,
            });
          }

          if (!rows || rows.length === 0) {
            break;
          }
        }
      }

      return {
        success: true,
        access: hasFullAccess ? "full" as const : "masked" as const,
        page: 1,
        pageSize: 0,
        total: allRows.length,
        rows: allRows,
      } as VerbasResponse;
    },
    enabled: hasFullAccess,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });

  // ── Cobertura de meses — calculada a partir dos dados já carregados ────────
  const monthCoverage = useMemo(() => {
    const rows = data?.rows;
    if (!rows?.length) return {} as Record<number, boolean[]>;
    const coverage: Record<number, boolean[]> = {};
    for (const yearStr of selectedYears) {
      const year = Number(yearStr);
      const yearRows = rows.filter((r) => r.ano === year);
      if (!yearRows.length) {
        coverage[year] = Array(12).fill(false);
        continue;
      }
      coverage[year] = MONTH_COLUMNS.map((m) =>
        yearRows.some((r) => Math.abs(Number((r as Record<string, unknown>)[m]) || 0) > 0),
      );
    }
    return coverage;
  }, [data?.rows, selectedYears]);

  const runSync = async (
    months: number[],
    modeLabel: string,
    options?: { includeFilters?: boolean; allPages?: boolean; maxPages?: number },
  ) => {
    setSyncing(true);
    setSyncError(null);
    setSyncWarning(null);
    setSyncSummary(null);
    setSyncChecklist([]);
    setActiveJobId(null);
    setJobStatus(null);
    setPreviewResult(null);

    try {
      const targetYears = selectedYears.map(Number).filter(Number.isFinite).sort((a, b) => b - a);
      if (!targetYears.length) throw new Error("Selecione ao menos 1 ano para sincronizar.");

      const totalSteps = targetYears.length * months.length;
      let completedSteps = 0;
      setSyncProgress({ current: 0, total: totalSteps, stepLabel: "Iniciando...", modeLabel });

      const aggregate = {
        received: 0, processed: 0, failed: 0, upserted: 0, duration_ms: 0,
        failure_reasons: new Map<string, number>(),
      };

      for (const year of targetYears) {
        for (const month of months) {
          const monthName = month === 0 ? "todos os meses" : (MONTH_NAMES_PT[month - 1] ?? String(month));
          setSyncProgress({
            current: completedSteps,
            total: totalSteps,
            stepLabel: `Sincronizando ${monthName} ${year}...`,
            modeLabel,
          });

          const includeFilters = options?.includeFilters !== false;
          const allPages = options?.allPages === true;

          const body: Record<string, unknown> = {
            ano: year,
            autoSyncWhenEmpty: false,
            syncNow: true,
            syncAllPages: allPages,
            syncMaxPages: allPages ? 5000 : (options?.maxPages ?? 25),
            page: 1,
            pageSize: 1000,
          };
          if (month > 0) {
            body.syncMonth = month; // 0 = sentinel "todos os meses" — não envia target_month ao sync-verbas
          }

          if (includeFilters) {
            // Prefer explicit company filter; otherwise fall back to the global company selector.
            // This prevents running an unscoped sync across all companies by accident.
            const effectiveCompanyId = companyFilter !== "all" ? companyFilter : null;
            if (effectiveCompanyId) body.companyId = effectiveCompanyId;
            if (departmentFilter !== "all") body.department = departmentFilter;
            if (positionFilter !== "all") body.position = positionFilter;
          }

          const { data: response, error: invokeError } = await supabase.functions.invoke(
            "verbas-secure-query",
            { body },
          );

          if (invokeError) {
            const details = await extractInvokeErrorDetails(invokeError);
            throw new Error(`Ano ${year}, mês ${month}: ${details || "Falha ao sincronizar"}`);
          }

          const typed = (response || {}) as VerbasResponse;
          const result = typed.sync_result;

          // Inicia polling se retornou job_id
          const returnedJobId = result?.job_id ?? (response as any)?.job_id ?? null;
          if (returnedJobId) {
            setActiveJobId(returnedJobId);
            setJobStatus(null);
          }

          aggregate.received += result?.received ?? 0;
          aggregate.processed += result?.processed ?? 0;
          aggregate.failed += result?.failed ?? 0;
          aggregate.upserted += result?.upserted ?? 0;
          aggregate.duration_ms += result?.duration_ms ?? 0;
          for (const r of result?.failure_reasons || []) {
            const k = r.reason || "erro";
            aggregate.failure_reasons.set(k, (aggregate.failure_reasons.get(k) || 0) + (r.count ?? 0));
          }
          if (typed.sync_error) throw new Error(`Ano ${year}, mês ${month}: ${typed.sync_error}`);

          completedSteps += 1;
          setSyncProgress({
            current: completedSteps,
            total: totalSteps,
            stepLabel: completedSteps === totalSteps
              ? "Concluído!"
              : `${monthName} ${year} processado`,
            modeLabel,
          });
        }
      }

      setSyncSummary({
        received: aggregate.received, processed: aggregate.processed,
        failed: aggregate.failed, upserted: aggregate.upserted,
        duration_ms: aggregate.duration_ms,
        failure_reasons: [...aggregate.failure_reasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 10),
      });
      setSyncChecklist([
        { label: "Recebeu dados da origem", ok: aggregate.received > 0 },
        { label: "Processamento concluído", ok: aggregate.processed >= aggregate.upserted },
        { label: "Sem falhas de integração", ok: aggregate.failed === 0 },
      ]);
      // Refreshing the UI can fail (network/transient) even when the sync succeeded.
      // Don't show a destructive error for a post-sync refresh failure.
      void refetch().catch((refreshErr) => {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        console.warn("verbas: post-sync refetch failed", refreshErr);
        setSyncWarning(
          `Sincronização concluída, mas não foi possível recarregar os dados automaticamente. Clique em "Buscar". (${msg})`,
        );
      });
    } catch (err) {
      setSyncError((err as Error).message || "Erro ao sincronizar verbas");
      setSyncWarning(null);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncVerbas = () => {
    runSync(
    [0], // 0 = sentinel "todos os meses": 1 chamada por ano, sem target_month, datalake consultado 1x
    "Sincronização anual",
    { includeFilters: false, allPages: true },
    );
  };

  const handleInitialBootstrap = () => runSync(
    [0], // 1 chamada por ano (sem target_month) — evita race condition de 12 chamadas concorrentes
    "Carga inicial completa",
    { includeFilters: false, allPages: true, maxPages: 5000 },
  );

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);
    setSyncError(null);
    try {
      const targetYears = selectedYears.map(Number).filter(Number.isFinite).sort((a, b) => b - a);
      if (!targetYears.length) throw new Error("Selecione ao menos 1 ano para o preview.");
      const year = targetYears[0]; // Preview usa sempre o primeiro ano selecionado
      const month = Number(closingMonth);
      const body: Record<string, unknown> = {
        ano: year,
        autoSyncWhenEmpty: false,
        previewOnly: true,
        syncAllPages: true,
        syncMaxPages: 5000,
        page: 1,
        pageSize: 1,
      };
      if (Number.isFinite(month) && month >= 1 && month <= 12) {
        body.syncMonth = month;
      }
      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "verbas-secure-query",
        { body },
      );
      if (invokeError) throw new Error(String(invokeError));
      const preview = (response as any)?.preview;
      if (preview) setPreviewResult(preview);
      else throw new Error("Resposta de preview inválida.");
    } catch (err) {
      setSyncError((err as Error).message || "Erro ao executar preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleMonthlyClose = () => {
    const m = Number(closingMonth);
    if (!Number.isFinite(m) || m < 1 || m > 12) { setSyncError("Mês inválido."); return; }
    runSync([m], "Fechamento mensal", { includeFilters: false, allPages: true });
  };

  const handleRecalcAssociations = async () => {
    setRecalculating(true);
    setRecalcResult(null);
    setSyncError(null);
    try {
      const targetYear = selectedYears.length ? Number(selectedYears[0]) : null;
      const { data, error } = await supabase.functions.invoke("verbas-secure-query", {
        body: { action: "recalcPivot", ano: targetYear },
      });
      if (error) throw new Error((error as any)?.message || String(error));
      const result = data as { staging_rows: number; inserted_or_updated: number; cpfs_sem_empresa: number };
      setRecalcResult(result);
      void refetch().catch(() => null);
    } catch (err) {
      setSyncError((err as Error).message || "Erro ao recalcular associações");
    } finally {
      setRecalculating(false);
    }
  };

  // ── Filter options ────────────────────────────────────────────────────────
  // Empresas: lista estática do banco (independente dos dados filtrados)
  // Cargo/Setor: derivados dos dados carregados (relevantes para a seleção atual)
  const filterOptions = useMemo(() => {
    const positions = new Set<string>();
    const departments = new Set<string>();
    for (const row of data?.rows || []) {
      if (row.employee_position) positions.add(row.employee_position);
      if (row.employee_department) departments.add(row.employee_department);
    }
    return {
      companies: (companiesList || []).map((c) => ({ id: c.id, name: c.name || c.id })),
      positions: [...positions].sort((a, b) => a.localeCompare(b)),
      departments: [...departments].sort((a, b) => a.localeCompare(b)),
    };
  }, [companiesList, data?.rows]);

  // ── Hierarchy: EMPRESA → GRUPO CONTÁBIL → CARGO → FUNCIONÁRIO ────────────
  const { companyNodes, accountingRootNodes, kpi, tableRows } = useMemo(() => {
    // Step 1: flatten rows into employee nodes
    const employeesMap = new Map<string, EmployeeNode>();

    for (const row of data?.rows || []) {
      const empKey = `${row.company_id}|${row.cpf}|${row.nome_funcionario}`;

      if (!employeesMap.has(empKey)) {
        employeesMap.set(empKey, {
          key: empKey,
          companyId: row.company_id,
          razaoSocial: row.razao_social || row.company_id,
          department: row.employee_department || "Sem Setor",
          unit: row.employee_unit || "Sem Unidade",
          position: row.employee_position || "Sem Cargo",
          accountingGroup: row.employee_accounting_group || "—",
          compareGroupKey: row.compare_group_key || `${row.company_id}|${String(row.employee_position || "SEM_CARGO").trim().toUpperCase()}`,
          cpf: row.cpf,
          nome: row.nome_funcionario,
          total: 0,
          tipos: [],
        });
      }

      const emp = employeesMap.get(empKey)!;
      const tipo = row.tipo_verba || "OUTROS";
      let tipoNode = emp.tipos.find((t) => t.tipo === tipo);
      if (!tipoNode) {
        tipoNode = { tipo, total: 0, yearsMap: new Map() };
        emp.tipos.push(tipoNode);
      }

      const rowYear = Number(row.ano);
      if (!tipoNode.yearsMap.has(rowYear)) {
        tipoNode.yearsMap.set(rowYear, {
          janeiro: 0, fevereiro: 0, marco: 0, abril: 0, maio: 0, junho: 0,
          julho: 0, agosto: 0, setembro: 0, outubro: 0, novembro: 0, dezembro: 0,
        });
      }
      const ym = tipoNode.yearsMap.get(rowYear)!;
      let rt = 0;
      for (const m of MONTH_COLUMNS) {
        const v = Number(row[m] ?? 0);
        if (Number.isFinite(v) && v !== 0) { ym[m] += v; rt += v; }
      }
      tipoNode.total += rt;
      emp.total += rt;
    }

    // Sort tipos by total desc per employee
    for (const emp of employeesMap.values()) {
      emp.tipos.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    }

    // Step 2: build EMPRESA → GRUPO → CARGO structure
    const companiesMap = new Map<
      string,
      {
        razaoSocial: string;
        positionsAllMap: Map<string, EmployeeNode[]>;
        groupsMap: Map<string, Map<string, EmployeeNode[]>>;
      }
    >();

    // Step 2b: build GRUPO CONTÁBIL → CARGO structure (across companies)
    const accountingGroupsGlobalMap = new Map<
      string,
      {
        positionsMap: Map<string, EmployeeNode[]>;
        companyIds: Set<string>;
      }
    >();

    for (const emp of employeesMap.values()) {
      if (!companiesMap.has(emp.companyId)) {
        companiesMap.set(emp.companyId, {
          razaoSocial: emp.razaoSocial,
          positionsAllMap: new Map(),
          groupsMap: new Map(),
        });
      }
      const co = companiesMap.get(emp.companyId)!;

      if (!co.positionsAllMap.has(emp.position)) co.positionsAllMap.set(emp.position, []);
      co.positionsAllMap.get(emp.position)!.push(emp);

      const groupKey = emp.accountingGroup || "—";
      if (!co.groupsMap.has(groupKey)) co.groupsMap.set(groupKey, new Map());
      const gm = co.groupsMap.get(groupKey)!;
      if (!gm.has(emp.position)) gm.set(emp.position, []);
      gm.get(emp.position)!.push(emp);

      if (!accountingGroupsGlobalMap.has(groupKey)) {
        accountingGroupsGlobalMap.set(groupKey, {
          positionsMap: new Map(),
          companyIds: new Set(),
        });
      }
      const gg = accountingGroupsGlobalMap.get(groupKey)!;
      gg.companyIds.add(emp.companyId);
      if (!gg.positionsMap.has(emp.position)) gg.positionsMap.set(emp.position, []);
      gg.positionsMap.get(emp.position)!.push(emp);
    }

    // Step 3: compute benchmark avg per (company + position) and build final tree
    const nodes: CompanyNode[] = [];
    let totalMassa = 0;
    let totalEmployeesAll = 0;

    for (const [companyId, co] of companiesMap.entries()) {
      const avgByPosition = new Map<string, number>();
      for (const [position, emps] of co.positionsAllMap.entries()) {
        const posTotal = emps.reduce((s, e) => s + e.total, 0);
        avgByPosition.set(position, emps.length ? posTotal / emps.length : 0);
      }

      const accountingGroupNodes: AccountingGroupNode[] = [];
      let companyTotal = 0;
      const companyCpfs = new Set<string>();

      for (const [accountingGroup, positionsMap] of co.groupsMap.entries()) {
        const positionNodes: PositionNode[] = [];
        let groupTotal = 0;
        const groupCpfs = new Set<string>();

        for (const [position, emps] of positionsMap.entries()) {
          const posTotal = emps.reduce((s, e) => s + e.total, 0);
          const posAvg = avgByPosition.get(position) ?? (emps.length ? posTotal / emps.length : 0);
          for (const e of emps) {
            groupCpfs.add(e.cpf);
            companyCpfs.add(e.cpf);
          }

          positionNodes.push({
            position,
            total: posTotal,
            employeeCount: emps.length,
            avgPerEmployee: posAvg,
            employees: [...emps].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
          });
          groupTotal += posTotal;
        }

        positionNodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
        accountingGroupNodes.push({
          accountingGroup,
          total: groupTotal,
          employeeCount: groupCpfs.size,
          positionNodes,
        });

        companyTotal += groupTotal;
      }

      accountingGroupNodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
      nodes.push({
        companyId,
        razaoSocial: co.razaoSocial,
        total: companyTotal,
        employeeCount: companyCpfs.size,
        accountingGroupNodes,
      });
      totalMassa += companyTotal;
      totalEmployeesAll += companyCpfs.size;
    }

    nodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    // Step 4: build GRUPO CONTÁBIL → CARGO → FUNCIONÁRIO (global view)
    const globalNodes: AccountingRootNode[] = [];
    for (const [accountingGroup, g] of accountingGroupsGlobalMap.entries()) {
      const positionNodes: PositionNode[] = [];
      let groupTotal = 0;
      const groupCpfs = new Set<string>();

      for (const [position, emps] of g.positionsMap.entries()) {
        const posTotal = emps.reduce((s, e) => s + e.total, 0);
        const posAvg = emps.length ? posTotal / emps.length : 0;
        for (const e of emps) groupCpfs.add(e.cpf);

        positionNodes.push({
          position,
          total: posTotal,
          employeeCount: emps.length,
          avgPerEmployee: posAvg,
          employees: [...emps].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
        });
        groupTotal += posTotal;
      }

      positionNodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
      globalNodes.push({
        accountingGroup,
        total: groupTotal,
        employeeCount: groupCpfs.size,
        companyCount: g.companyIds.size,
        positionNodes,
      });
    }
    globalNodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    // ── Flat table rows (for Excel-like table view) ──────────────────────────
    const tableRowsRaw: TableRow[] = [];
    for (const emp of employeesMap.values()) {
      const months: MonthMap = {
        janeiro: 0, fevereiro: 0, marco: 0, abril: 0, maio: 0, junho: 0,
        julho: 0, agosto: 0, setembro: 0, outubro: 0, novembro: 0, dezembro: 0,
      };
      for (const tipo of emp.tipos) {
        for (const [, ym] of tipo.yearsMap.entries()) {
          for (const m of MONTH_COLUMNS) months[m] += ym[m];
        }
      }
      tableRowsRaw.push({
        companyId: emp.companyId,
        razaoSocial: emp.razaoSocial,
        cpf: emp.cpf,
        nome: emp.nome,
        cargo: emp.position,
        setor: emp.department,
        grupoContabil: emp.accountingGroup,
        months,
        total: emp.total,
      });
    }

    tableRowsRaw.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "nome") cmp = a.nome.localeCompare(b.nome, "pt-BR");
      else if (sortKey === "empresa") cmp = a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
      else if (sortKey === "total") cmp = Math.abs(b.total) - Math.abs(a.total);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return {
      companyNodes: nodes,
      accountingRootNodes: globalNodes,
      tableRows: tableRowsRaw,
      kpi: {
        totalMassa,
        totalEmployees: totalEmployeesAll,
        avgPerEmployee: totalEmployeesAll > 0 ? totalMassa / totalEmployeesAll : 0,
        totalCompanies: nodes.length,
      },
    };
  }, [data?.rows, sortKey, sortDir]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!role) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!hasFullAccess) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Acesso restrito a diretoria</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  const hasData = !isLoading && !error && (
    viewMode === "table" ? tableRows.length > 0
    : viewMode === "company" ? companyNodes.length > 0
    : accountingRootNodes.length > 0
  );

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton to="/governanca-ec/pessoas-cultura" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">VERBAS</h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Análise de remuneração por Empresa · Grupo contábil · Cargo · Colaborador
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.access && (
              <Badge variant={data.access === "full" ? "default" : "secondary"}>
                {data.access === "full" ? (
                  <><Eye className="h-3 w-3 mr-1" /> Acesso completo</>
                ) : (
                  <><EyeOff className="h-3 w-3 mr-1" /> Dados mascarados</>
                )}
              </Badge>
            )}
            <RoleGuard roles={["super_admin", "ceo", "diretor"]}>
              <Button variant="outline" size="sm" onClick={() => setShowSyncPanel((v) => !v)}>
                <Settings2 className="h-4 w-4 mr-1" />
                Sincronização
              </Button>
            </RoleGuard>
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Massa Salarial", value: isLoading ? null : formatCurrency(kpi.totalMassa, true), sub: selectedYears.join(" · "), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950" },
            { label: "Colaboradores", value: isLoading ? null : (kpi.totalEmployees || 0).toLocaleString("pt-BR"), sub: companyFilter !== "all" ? (filterOptions.companies.find(c => c.id === companyFilter)?.name ?? "empresa selecionada") : "todas as empresas", icon: Users, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
            { label: "Média / Colaborador", value: isLoading ? null : formatCurrency(kpi.avgPerEmployee, true), sub: "no período selecionado", icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-950" },
            { label: companyFilter !== "all" ? "Grupos contábeis" : "Empresas na visão", value: isLoading ? null : (companyFilter !== "all" ? companyNodes[0]?.accountingGroupNodes.length ?? 0 : kpi.totalCompanies).toString(), sub: companyFilter !== "all" ? "na empresa selecionada" : "com dados no período", icon: Building2, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950" },
          ].map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", card.bg)}>
                    <card.icon className={cn("h-3.5 w-3.5", card.color)} />
                  </div>
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoading ? <Skeleton className="h-7 w-28" /> : (
                  <>
                    <p className="text-2xl font-bold tabular-nums">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Período</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-36 justify-between" disabled={isFetching}>
                      {yearsLabel}
                      <ChevronDown className="h-4 w-4 ml-2 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-36" align="start">
                    {availableYears.map((year) => (
                      <DropdownMenuCheckboxItem key={year} checked={selectedYears.includes(year)} onCheckedChange={() => toggleYear(year)}>
                        {year}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Empresa</p>
                <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPositionFilter("all"); setDepartmentFilter("all"); }} disabled={isFetching}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {filterOptions.companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Cargo</p>
                <Select value={positionFilter} onValueChange={setPositionFilter} disabled={isFetching}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Todos os cargos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    {filterOptions.positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Setor</p>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isFetching}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {filterOptions.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tipo de verba</p>
                <Select value={tipoVerba} onValueChange={setTipoVerba} disabled={isFetching}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {TIPO_VERBA_OPTIONS.map((t) => <SelectItem key={t} value={t}>{TIPO_VERBA_LABELS[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Nome</p>
                <Input value={nomeInput} onChange={(e) => setNomeInput(e.target.value)} placeholder="Buscar nome..." className="w-48" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">CPF</p>
                <Input value={cpfInput} onChange={(e) => setCpfInput(e.target.value)} placeholder="000.000.000-00" className="w-40" />
              </div>
              {isFetching && (
                <div className="self-end flex items-center gap-1.5 text-xs text-muted-foreground pb-2.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Carregando...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Sync panel (collapsible) ────────────────────────────────────── */}
        <RoleGuard roles={["super_admin", "ceo", "diretor"]}>
        <Collapsible open={showSyncPanel} onOpenChange={setShowSyncPanel}>
          <CollapsibleContent>
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-4">

                {/* ── Saúde da Integração ───────────────────────────────── */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">Saúde da Integração</p>

                  {/* Último sync + métricas */}
                  <div className="rounded-md border bg-muted/10 p-3 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          lastSuccessfulSync ? "bg-emerald-500" : "bg-amber-500",
                        )} />
                        <span className="text-sm font-medium text-foreground">
                          {lastSuccessfulSync
                            ? `Última sincronização: ${new Date(lastSuccessfulSync.completed_at || lastSuccessfulSync.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                            : "Nenhuma sincronização bem-sucedida encontrada"
                          }
                        </span>
                        {lastSuccessfulSync && (
                          <span className="text-xs text-muted-foreground">
                            ({(() => {
                              const diff = Date.now() - new Date(lastSuccessfulSync.completed_at || lastSuccessfulSync.started_at).getTime();
                              const minutes = Math.floor(diff / 60_000);
                              if (minutes < 1) return "agora";
                              if (minutes < 60) return `há ${minutes}min`;
                              const hours = Math.floor(minutes / 60);
                              if (hours < 24) return `há ${hours}h`;
                              const days = Math.floor(hours / 24);
                              return `há ${days}d`;
                            })()})
                          </span>
                        )}
                      </div>
                      {lastSuccessfulSync && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{lastSuccessfulSync.records_received.toLocaleString("pt-BR")} rec.</span>
                          <span>{lastSuccessfulSync.records_upserted.toLocaleString("pt-BR")} grav.</span>
                          {lastSuccessfulSync.records_failed > 0 && (
                            <span className="text-destructive">{lastSuccessfulSync.records_failed} falhas</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cobertura de meses */}
                    {monthCoverage && Object.keys(monthCoverage).length > 0 && (
                      <div className="space-y-1.5">
                        {Object.entries(monthCoverage)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([yearStr, months]) => (
                            <div key={yearStr} className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground w-10 tabular-nums">{yearStr}</span>
                              <div className="flex items-center gap-1">
                                {(months as boolean[]).map((hasCoverage, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-medium transition-colors",
                                      hasCoverage
                                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                        : "bg-muted text-muted-foreground/50 border border-transparent",
                                    )}
                                    title={`${MONTH_NAMES_PT[i]} ${yearStr}: ${hasCoverage ? "com dados" : "sem dados"}`}
                                  >
                                    {MONTH_NAMES_PT[i][0]}
                                  </div>
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {(months as boolean[]).filter(Boolean).length}/12
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Histórico de syncs recentes */}
                  {recentJobs && recentJobs.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="sync-history" className="border rounded-md">
                        <AccordionTrigger className="px-3 py-2 text-xs font-medium text-muted-foreground hover:no-underline">
                          Histórico de sincronizações ({recentJobs.length})
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          <div className="space-y-1">
                            {recentJobs.map((job) => (
                              <div
                                key={job.id}
                                className={cn(
                                  "flex items-center gap-2 text-xs rounded px-2 py-1.5",
                                  job.status === "error" ? "bg-destructive/5" : "bg-transparent",
                                )}
                              >
                                <Badge
                                  variant={
                                    job.status === "done" ? "default"
                                    : job.status === "error" ? "destructive"
                                    : job.status === "running" ? "secondary"
                                    : "outline"
                                  }
                                  className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                                >
                                  {job.status === "done" && "OK"}
                                  {job.status === "error" && "Erro"}
                                  {job.status === "running" && "..."}
                                  {job.status === "queued" && "Fila"}
                                </Badge>
                                <span className="text-muted-foreground tabular-nums shrink-0">
                                  {new Date(job.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span className="text-foreground shrink-0">
                                  {job.ano}{job.mes ? ` · Mês ${job.mes}` : " · Todos"}
                                </span>
                                <span className="text-muted-foreground truncate">
                                  {job.records_received > 0 && `${job.records_received.toLocaleString("pt-BR")} rec`}
                                  {job.records_failed > 0 && ` · ${job.records_failed} falhas`}
                                  {job.error_message && ` — ${job.error_message}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>

                {/* ── Operações de Sincronização ─────────────────────────── */}
                <p className="text-sm font-semibold text-muted-foreground pt-1">Operações de Sincronização</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="secondary" disabled={syncing}>
                        {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Carga inicial completa (todas empresas)
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar carga inicial completa</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta operação irá sincronizar todos os 12 meses do(s) ano(s) selecionado(s) para todas as empresas, sem filtros.
                          Pode levar vários minutos e sobrecarregar o Datalake temporariamente. Confirma?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleInitialBootstrap}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" onClick={handleSyncVerbas} disabled={syncing}>
                    {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sincronização anual (12 meses, com filtros)
                  </Button>
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Mês de fechamento</p>
                      <Select value={closingMonth} onValueChange={setClosingMonth}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={handleMonthlyClose} disabled={syncing}>Fechamento mensal (1 mês)</Button>
                  </div>
                  <Button variant="secondary" onClick={handlePreview} disabled={syncing || previewing}>
                    {previewing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Preview (sem importar)
                  </Button>
                  <Button variant="outline" onClick={handleRecalcAssociations} disabled={syncing || recalculating}>
                    {recalculating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Recalcular associações
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin/datalake?tab=logs")}>Ver logs</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obs.: a sincronização anual ignora o mês de fechamento; para sincronizar apenas um mês, use &ldquo;Fechamento mensal (1 mês)&rdquo;. O Preview usa o mês de fechamento selecionado.
                  {" "}<strong>Recalcular associações</strong> re-executa o JOIN staging → empresas sem re-buscar dados do DAB.
                </p>

                {/* ── Resultado recalcular ───────────────────────────────────── */}
                {recalcResult && (
                  <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-4 text-sm">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold">✓ Associações recalculadas</span>
                    <span className="text-foreground tabular-nums"><strong>{recalcResult.staging_rows}</strong> staging</span>
                    <span className="text-foreground tabular-nums"><strong>{recalcResult.inserted_or_updated}</strong> no pivot</span>
                    {recalcResult.cpfs_sem_empresa > 0 && (
                      <span className="text-amber-600 tabular-nums"><strong>{recalcResult.cpfs_sem_empresa}</strong> CPFs sem empresa</span>
                    )}
                  </div>
                )}

                {/* ── Preview result panel ───────────────────────────────────── */}
                {previewResult && (
                  <div className="rounded-md border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      Preview — {selectedYears[0]} / Mês {closingMonth}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-md bg-white dark:bg-blue-900/30 p-3 text-center">
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{previewResult.distinct_cpfs_in_source}</p>
                        <p className="text-xs text-muted-foreground mt-1">CPFs no DAB</p>
                      </div>
                      <div className="rounded-md bg-white dark:bg-blue-900/30 p-3 text-center">
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{previewResult.cpfs_matched}</p>
                        <p className="text-xs text-muted-foreground mt-1">Com empresa (importáveis)</p>
                      </div>
                      <div className="rounded-md bg-white dark:bg-blue-900/30 p-3 text-center">
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{previewResult.cpfs_sem_empresa}</p>
                        <p className="text-xs text-muted-foreground mt-1">Sem empresa associada</p>
                      </div>
                      <div className="rounded-md bg-white dark:bg-blue-900/30 p-3 text-center">
                        <p className="text-2xl font-bold text-slate-500">{previewResult.cpfs_not_found}</p>
                        <p className="text-xs text-muted-foreground mt-1">Não cadastrados (ignorados)</p>
                      </div>
                    </div>
                    {previewResult.cpfs_sem_empresa > 0 && (
                      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {previewResult.cpfs_sem_empresa} colaborador(es) encontrado(s) no DAB sem empresa associada no GA 360
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Esses funcionários existem em <strong>Funcionários Externos</strong> mas sem <code>company_id</code> resolvível.
                          Edite o cadastro de cada um para associar a empresa correta.
                        </p>
                        {(previewResult.sem_empresa_records || []).length > 0 && (
                          <div className="max-h-48 overflow-y-auto rounded border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-900/20">
                            <table className="w-full text-xs">
                              <thead className="bg-amber-100 dark:bg-amber-900/40">
                                <tr>
                                  <th className="text-left px-2 py-1.5 font-medium text-amber-900 dark:text-amber-200">Nome</th>
                                  <th className="text-left px-2 py-1.5 font-medium text-amber-900 dark:text-amber-200 tabular-nums">CPF</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(previewResult.sem_empresa_records || []).map((r, i) => (
                                  <tr key={r.cpf + i} className="border-t border-amber-100 dark:border-amber-800">
                                    <td className="px-2 py-1.5 text-foreground">{r.nome}</td>
                                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{r.cpf}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                    {previewResult.cpfs_not_found > 0 && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {previewResult.cpfs_not_found} CPF(s) encontrado(s) no DAB sem nenhum cadastro na tabela de funcionários externos — serão ignorados na importação.
                      </p>
                    )}
                    <Button size="sm" onClick={handleSyncVerbas} disabled={syncing}>
                      {syncing ? <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                      Confirmar importação
                    </Button>
                  </div>
                )}

                {/* ── Progresso legado (enquanto job ainda não retornou job_id) ── */}
                {syncing && !activeJobId && !jobStatus && syncProgress && (
                  <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">{syncProgress.modeLabel}</p>
                        <p className="text-xs text-muted-foreground">{syncProgress.stepLabel}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%
                      </span>
                    </div>
                    <Progress
                      value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground text-right tabular-nums">
                      {syncProgress.current} de {syncProgress.total} {syncProgress.total === 1 ? "etapa" : "etapas"} concluídas
                    </p>
                  </div>
                )}

                {/* ── Painel de status do job (polling em tempo real) ───────── */}
                {jobStatus && (
                  <div className="rounded-md border p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        jobStatus.status === "done" ? "default"
                        : jobStatus.status === "error" ? "destructive"
                        : "secondary"
                      }>
                        {jobStatus.status === "queued" && "Na fila"}
                        {jobStatus.status === "running" && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Sincronizando...
                          </span>
                        )}
                        {jobStatus.status === "done" && "✓ Concluído"}
                        {jobStatus.status === "error" && "✗ Erro"}
                      </Badge>
                      <span className="text-muted-foreground">
                        Ano {jobStatus.ano}{jobStatus.mes ? ` · Mês ${jobStatus.mes}` : " · Todos os meses"}
                      </span>
                      {(jobStatus.status === "running" || jobStatus.status === "queued") && (
                        <span className="text-muted-foreground ml-auto">Atualiza em 3s...</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: "Páginas", value: jobStatus.pages_fetched },
                        { label: "Recebidos", value: jobStatus.records_received },
                        { label: "Gravados", value: jobStatus.records_upserted },
                        { label: "Falhas", value: jobStatus.records_failed, alert: jobStatus.records_failed > 0 },
                      ].map((item) => (
                        <div key={item.label} className={cn(
                          "rounded border px-2 py-1.5 text-center",
                          item.alert ? "border-destructive/50 bg-destructive/10" : "bg-background",
                        )}>
                          <p className={cn("text-sm font-bold tabular-nums", item.alert ? "text-destructive" : "text-foreground")}>
                            {item.value.toLocaleString("pt-BR")}
                          </p>
                          <p className="text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    {jobStatus.error_message && (
                      <p className="text-destructive">{jobStatus.error_message}</p>
                    )}
                    {jobStatus.status === "done" && jobStatus.records_received > 0 && (
                      <p className="text-emerald-600 font-medium">
                        {jobStatus.records_received.toLocaleString("pt-BR")} registros recebidos do datalake
                        {jobStatus.pages_fetched > 0 && ` em ${jobStatus.pages_fetched} ${jobStatus.pages_fetched === 1 ? "página" : "páginas"}`}.
                        {" "}{jobStatus.records_upserted.toLocaleString("pt-BR")} gravados no banco.
                      </p>
                    )}
                    {jobStatus.status === "done" && jobStatus.records_received === 0 && (
                      <p className="text-amber-600 font-medium">
                        Datalake não retornou registros para este período. Verifique o filtro de ano e a disponibilidade dos dados na origem.
                      </p>
                    )}
                  </div>
                )}

                {/* ── Resultado / erros (sync legado sem job_id) ───────────── */}
                {!jobStatus && (syncError || syncWarning || syncSummary || syncChecklist.length > 0) && (
                  <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs">
                    {syncError && (
                      <div className="flex items-start gap-2 text-destructive">
                        <span className="shrink-0">✗</span>
                        <p>{syncError}</p>
                      </div>
                    )}
                    {syncWarning && <p className="text-muted-foreground">⚠️ {syncWarning}</p>}
                    {syncSummary && !syncError && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "Recebidos", value: syncSummary.received ?? 0 },
                          { label: "Processados", value: syncSummary.processed ?? 0 },
                          { label: "Gravados", value: syncSummary.upserted ?? 0 },
                          { label: "Falhas", value: syncSummary.failed ?? 0, alert: (syncSummary.failed ?? 0) > 0 },
                        ].map((item) => (
                          <div key={item.label} className={cn(
                            "rounded border px-2 py-1.5 text-center",
                            item.alert ? "border-destructive/50 bg-destructive/10" : "bg-background",
                          )}>
                            <p className={cn("text-base font-bold tabular-nums", item.alert ? "text-destructive" : "text-foreground")}>
                              {item.value.toLocaleString("pt-BR")}
                            </p>
                            <p className="text-muted-foreground">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {syncChecklist.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        {syncChecklist.map((c) => (
                          <span key={c.label} className={cn("flex items-center gap-1", c.ok ? "text-emerald-600" : "text-amber-600")}>
                            {c.ok ? "✓" : "⚠"} {c.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
        </RoleGuard>

        {/* ── View mode toggle + result count ────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {!isLoading && !error && (
              <>
                <Users className="h-4 w-4" />
                <span>
                  <strong className="text-foreground">{kpi.totalEmployees}</strong> colaboradores ·{" "}
                  <strong className="text-foreground">{formatCurrency(kpi.totalMassa, true)}</strong> massa
                  {companyFilter !== "all" && (
                    <> · <Badge variant="outline" className="ml-1 text-xs">{filterOptions.companies.find(c => c.id === companyFilter)?.name ?? "empresa selecionada"}</Badge></>
                  )}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-3.5 w-3.5" />
              Tabela
            </Button>
            <Button
              variant={viewMode === "company" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setViewMode("company")}
            >
              <Building2 className="h-3.5 w-3.5" />
              Por empresa
            </Button>
            <Button
              variant={viewMode === "accounting" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setViewMode("accounting")}
            >
              <PieChart className="h-3.5 w-3.5" />
              Por grupo contábil
            </Button>
          </div>
        </div>

        {/* ── Main hierarchy: EMPRESA → GRUPO → CARGO → FUNCIONÁRIO ─────── */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
            ) : !hasData ? (
              <div className="p-12 text-center space-y-3">
                <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground font-medium">Nenhum registro encontrado.</p>
                {(cpf || nome || tipoVerba !== "all" || positionFilter !== "all" || departmentFilter !== "all") ? (
                  <p className="text-xs text-muted-foreground">Ajuste os filtros acima.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhum dado para o período e empresa selecionados.
                    Use o painel de <span className="font-medium">Sincronização</span> para importar dados do Datalake.
                  </p>
                )}
              </div>
            ) : viewMode === "table" ? (
              /* ── TABELA PLANA (Excel-like) ──────────────────────────────── */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0 z-10">
                    <tr>
                      {[
                        { key: "empresa" as const, label: "Empresa", className: "text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap min-w-[160px]" },
                        { key: "nome" as const, label: "Nome", className: "text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap min-w-[180px]" },
                        { key: null, label: "CPF", className: "text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap" },
                        { key: null, label: "Cargo", className: "text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap" },
                        { key: null, label: "Setor", className: "text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap" },
                      ].map((col) => (
                        <th key={col.label} className={col.className}>
                          {col.key ? (
                            <button
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                              onClick={() => {
                                if (sortKey === col.key) setSortDir(d => d === "asc" ? "desc" : "asc");
                                else { setSortKey(col.key!); setSortDir("asc"); }
                              }}
                            >
                              {col.label}
                              {sortKey === col.key
                                ? sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                            </button>
                          ) : col.label}
                        </th>
                      ))}
                      {MONTH_COLUMNS.map((m) => (
                        <th key={m} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap tabular-nums min-w-[80px]">
                          {MONTH_LABELS[m]}
                        </th>
                      ))}
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap min-w-[100px]">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                          onClick={() => {
                            if (sortKey === "total") setSortDir(d => d === "asc" ? "desc" : "asc");
                            else { setSortKey("total"); setSortDir("desc"); }
                          }}
                        >
                          Total
                          {sortKey === "total"
                            ? sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows: ReactNode[] = [];
                      let lastCompanyId = "";
                      let companySubtotal = 0;
                      let companyEmployees = 0;
                      const companyMonths: MonthMap = { janeiro: 0, fevereiro: 0, marco: 0, abril: 0, maio: 0, junho: 0, julho: 0, agosto: 0, setembro: 0, outubro: 0, novembro: 0, dezembro: 0 };

                      const flushCompanyRow = (companyId: string, razaoSocial: string) => {
                        rows.push(
                          <tr key={`subtotal-${companyId}`} className="bg-muted/30 border-y font-semibold text-xs">
                            <td className="px-4 py-2 text-foreground" colSpan={2}>
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                                {razaoSocial}
                                <Badge variant="secondary" className="ml-1 text-xs font-normal">{companyEmployees} colab.</Badge>
                              </span>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground" colSpan={3} />
                            {MONTH_COLUMNS.map((m) => (
                              <td key={m} className={cn("px-3 py-2 text-right tabular-nums", companyMonths[m] !== 0 ? "text-foreground" : "text-muted-foreground/40")}>
                                {companyMonths[m] !== 0 ? formatCurrency(companyMonths[m], true) : "—"}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(companySubtotal, true)}
                            </td>
                          </tr>
                        );
                      };

                      for (let i = 0; i < tableRows.length; i++) {
                        const row = tableRows[i];
                        const isFirstOfCompany = row.companyId !== lastCompanyId;

                        if (isFirstOfCompany && lastCompanyId) {
                          flushCompanyRow(lastCompanyId, tableRows.find(r => r.companyId === lastCompanyId)?.razaoSocial ?? lastCompanyId);
                          companySubtotal = 0;
                          companyEmployees = 0;
                          for (const m of MONTH_COLUMNS) companyMonths[m] = 0;
                        }

                        if (isFirstOfCompany) lastCompanyId = row.companyId;
                        companySubtotal += row.total;
                        companyEmployees++;
                        for (const m of MONTH_COLUMNS) companyMonths[m] += row.months[m];

                        rows.push(
                          <tr key={row.cpf + i} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[160px]">{row.razaoSocial}</td>
                            <td className="px-4 py-2.5 font-medium truncate max-w-[180px]">{row.nome}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{row.cpf}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">{row.cargo}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[120px]">{row.setor}</td>
                            {MONTH_COLUMNS.map((m) => (
                              <td key={m} className={cn("px-3 py-2.5 text-right tabular-nums text-xs whitespace-nowrap", row.months[m] !== 0 ? "text-foreground" : "text-muted-foreground/30")}>
                                {row.months[m] !== 0 ? formatCurrency(row.months[m], true) : "—"}
                              </td>
                            ))}
                            <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold whitespace-nowrap">
                              {formatCurrency(row.total, true)}
                            </td>
                          </tr>
                        );

                        // Last row — flush last company subtotal
                        if (i === tableRows.length - 1) {
                          flushCompanyRow(lastCompanyId, row.razaoSocial);
                        }
                      }

                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "company" ? (
              <Accordion type="multiple" className="w-full">
                {companyNodes.map((company) => (
                  <AccordionItem key={company.companyId} value={company.companyId} className="border-b last:border-b-0">

                    {/* ── NÍVEL 1: EMPRESA ───────────────────────────────── */}
                    <AccordionTrigger className="hover:no-underline px-6 py-4">
                      <div className="flex flex-1 items-center gap-4 text-left mr-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950 shrink-0">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base truncate">{company.razaoSocial}</p>
                          <p className="text-xs text-muted-foreground">
                            {company.employeeCount} colaboradores · {company.accountingGroupNodes.length} grupos contábeis
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-bold tabular-nums">{formatCurrency(company.total, true)}</p>
                            <p className="text-xs text-muted-foreground">massa total</p>
                          </div>
                          <Badge variant="secondary" className="tabular-nums">
                            {formatCurrency(company.total / Math.max(company.employeeCount, 1), true)}/colab.
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-0 pb-0">

                      {/* Bar chart: distribuição por grupo contábil */}
                      {company.accountingGroupNodes.length > 1 && (
                        <div className="px-6 py-3 bg-muted/20 border-b">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição por grupo contábil</p>
                          <div className="h-[110px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={company.accountingGroupNodes.slice(0, 12).map((g) => ({
                                  n: g.accountingGroup.length > 16 ? g.accountingGroup.slice(0, 14) + "…" : g.accountingGroup,
                                  t: g.total,
                                  c: g.employeeCount,
                                }))}
                                margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="n" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(v) => `R$${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={52} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                                  formatter={(v, nm) => nm === "t" ? [formatCurrency(Number(v), true), "Massa"] : [v, "Colaboradores"]}
                                />
                                <Bar dataKey="t" radius={[4, 4, 0, 0]}>
                                  {company.accountingGroupNodes.slice(0, 12).map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* ── NÍVEL 2: GRUPO CONTÁBIL ────────────────────────── */}
                      <Accordion type="multiple" className="w-full">
                        {company.accountingGroupNodes.map((groupNode) => {
                          const groupKey = `${company.companyId}|${groupNode.accountingGroup}`;
                          const groupShare = company.total > 0 ? (groupNode.total / company.total) * 100 : 0;

                          return (
                            <AccordionItem key={groupKey} value={groupKey} className="border-b last:border-b-0">
                              <AccordionTrigger className="hover:no-underline px-6 py-3 pl-16">
                                <div className="flex flex-1 items-center gap-3 text-left mr-3">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 shrink-0">
                                    <DollarSign className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{groupNode.accountingGroup}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {groupNode.employeeCount} colaborador{groupNode.employeeCount !== 1 ? "es" : ""} · {groupNode.positionNodes.length} cargos
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <p className="font-bold tabular-nums">{formatCurrency(groupNode.total, true)}</p>
                                      <p className="text-xs text-muted-foreground">{groupShare.toFixed(1)}% da empresa</p>
                                    </div>
                                  </div>
                                </div>
                              </AccordionTrigger>

                              <AccordionContent className="px-0 pb-2">
                                {/* ── NÍVEL 3: CARGO ─────────────────────── */}
                                <Accordion type="multiple" className="w-full">
                                  {groupNode.positionNodes.map((posNode) => {
                                    const posKey = `${groupKey}|${posNode.position}`;
                                    const posShare = groupNode.total > 0 ? (posNode.total / groupNode.total) * 100 : 0;
                                    return (
                                      <AccordionItem key={posKey} value={posKey} className="border-b last:border-b-0">
                                        <AccordionTrigger className="hover:no-underline px-6 py-3 pl-[88px]">
                                          <div className="flex flex-1 items-center gap-3 text-left mr-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950 shrink-0">
                                              <Briefcase className="h-4 w-4 text-violet-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="font-medium truncate">{posNode.position}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {posNode.employeeCount} colaborador{posNode.employeeCount !== 1 ? "es" : ""}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                              <div className="text-right">
                                                <p className="font-bold tabular-nums">{formatCurrency(posNode.total, true)}</p>
                                                <p className="text-xs text-muted-foreground">{posShare.toFixed(1)}% do grupo</p>
                                              </div>
                                              <Badge variant="outline" className="tabular-nums text-xs">
                                                Média: {formatCurrency(posNode.avgPerEmployee, true)}
                                              </Badge>
                                            </div>
                                          </div>
                                        </AccordionTrigger>

                                        <AccordionContent className="px-0 pb-2">
                                          {/* ── NÍVEL 4: FUNCIONÁRIO ───── */}
                                          <Accordion type="multiple" className="w-full">
                                            {posNode.employees.map((emp) => {
                                              const empKey = `${posKey}|${emp.cpf}`;
                                              const empShare = posNode.total > 0 ? (emp.total / posNode.total) * 100 : 0;
                                              return (
                                                <AccordionItem key={emp.key} value={empKey} className="border-b last:border-b-0">
                                                  <AccordionTrigger className="hover:no-underline px-6 py-3 pl-[112px]">
                                                    <div className="flex flex-1 items-center gap-3 text-left mr-3">
                                                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 text-xs font-bold text-muted-foreground">
                                                        {(emp.nome || "?").slice(0, 1).toUpperCase()}
                                                      </div>
                                                      <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-sm truncate">{emp.nome}</p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                          CPF {emp.cpf} · {emp.department} · {emp.accountingGroup}
                                                        </p>
                                                      </div>
                                                      <div className="flex items-center gap-2 shrink-0">
                                                        <p className="font-semibold tabular-nums text-sm">{formatCurrency(emp.total, true)}</p>
                                                        <Badge variant="secondary" className="text-xs tabular-nums">
                                                          {empShare.toFixed(1)}% do cargo
                                                        </Badge>
                                                        <DeltaBadge value={emp.total} avg={posNode.avgPerEmployee} />
                                                      </div>
                                                    </div>
                                                  </AccordionTrigger>
                                                  <AccordionContent className="pl-[112px] pr-6 pb-4">
                                                    <EmployeeTiposAccordion
                                                      tipos={emp.tipos}
                                                      employeeKey={emp.key}
                                                      selectedYears={selectedYears}
                                                    />
                                                  </AccordionContent>
                                                </AccordionItem>
                                              );
                                            })}
                                          </Accordion>
                                        </AccordionContent>
                                      </AccordionItem>
                                    );
                                  })}
                                </Accordion>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <Accordion type="multiple" className="w-full">
                {accountingRootNodes.map((groupNode) => {
                  const groupKey = groupNode.accountingGroup;
                  const groupShare = kpi.totalMassa > 0 ? (groupNode.total / kpi.totalMassa) * 100 : 0;

                  return (
                    <AccordionItem key={groupKey} value={groupKey} className="border-b last:border-b-0">
                      {/* ── NÍVEL 1: GRUPO CONTÁBIL (GLOBAL) ───────────── */}
                      <AccordionTrigger className="hover:no-underline px-6 py-4">
                        <div className="flex flex-1 items-center gap-4 text-left mr-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 shrink-0">
                            <DollarSign className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-base truncate">{groupNode.accountingGroup}</p>
                            <p className="text-xs text-muted-foreground">
                              {groupNode.employeeCount} colaboradores · {groupNode.companyCount} empresa{groupNode.companyCount !== 1 ? "s" : ""} · {groupNode.positionNodes.length} cargos
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-lg font-bold tabular-nums">{formatCurrency(groupNode.total, true)}</p>
                              <p className="text-xs text-muted-foreground">{groupShare.toFixed(1)}% do total</p>
                            </div>
                            <Badge variant="secondary" className="tabular-nums">
                              {formatCurrency(groupNode.total / Math.max(groupNode.employeeCount, 1), true)}/colab.
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-0 pb-2">
                        {/* ── NÍVEL 2: CARGO ───────────────────────── */}
                        <Accordion type="multiple" className="w-full">
                          {groupNode.positionNodes.map((posNode) => {
                            const posKey = `${groupKey}|${posNode.position}`;
                            const posShare = groupNode.total > 0 ? (posNode.total / groupNode.total) * 100 : 0;

                            return (
                              <AccordionItem key={posKey} value={posKey} className="border-b last:border-b-0">
                                <AccordionTrigger className="hover:no-underline px-6 py-3 pl-16">
                                  <div className="flex flex-1 items-center gap-3 text-left mr-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950 shrink-0">
                                      <Briefcase className="h-4 w-4 text-violet-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium truncate">{posNode.position}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {posNode.employeeCount} colaborador{posNode.employeeCount !== 1 ? "es" : ""}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                      <div className="text-right">
                                        <p className="font-bold tabular-nums">{formatCurrency(posNode.total, true)}</p>
                                        <p className="text-xs text-muted-foreground">{posShare.toFixed(1)}% do grupo</p>
                                      </div>
                                      <Badge variant="outline" className="tabular-nums text-xs">
                                        Média: {formatCurrency(posNode.avgPerEmployee, true)}
                                      </Badge>
                                    </div>
                                  </div>
                                </AccordionTrigger>

                                <AccordionContent className="px-0 pb-2">
                                  {/* ── NÍVEL 3: FUNCIONÁRIO ───────── */}
                                  <Accordion type="multiple" className="w-full">
                                    {posNode.employees.map((emp) => {
                                      const empKey = `${posKey}|${emp.cpf}`;
                                      const empShare = posNode.total > 0 ? (emp.total / posNode.total) * 100 : 0;
                                      return (
                                        <AccordionItem key={emp.key} value={empKey} className="border-b last:border-b-0">
                                          <AccordionTrigger className="hover:no-underline px-6 py-3 pl-[88px]">
                                            <div className="flex flex-1 items-center gap-3 text-left mr-3">
                                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 text-xs font-bold text-muted-foreground">
                                                {(emp.nome || "?").slice(0, 1).toUpperCase()}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <p className="font-medium text-sm truncate">{emp.nome}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                  {emp.razaoSocial} · CPF {emp.cpf} · {emp.department}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <p className="font-semibold tabular-nums text-sm">{formatCurrency(emp.total, true)}</p>
                                                <Badge variant="secondary" className="text-xs tabular-nums">
                                                  {empShare.toFixed(1)}% do cargo
                                                </Badge>
                                                <DeltaBadge value={emp.total} avg={posNode.avgPerEmployee} />
                                              </div>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent className="pl-[88px] pr-6 pb-4">
                                            <EmployeeTiposAccordion
                                              tipos={emp.tipos}
                                              employeeKey={emp.key}
                                              selectedYears={selectedYears}
                                            />
                                          </AccordionContent>
                                        </AccordionItem>
                                      );
                                    })}
                                  </Accordion>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}

            {hasData && (
              <div className="px-6 py-3 border-t flex items-center justify-between bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {kpi.totalEmployees} colaboradores · <strong className="text-foreground">{formatCurrency(kpi.totalMassa, true)}</strong> massa · {kpi.totalCompanies} empresa{kpi.totalCompanies !== 1 ? "s" : ""}
                </p>
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Atualizar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
