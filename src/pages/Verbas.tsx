import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert, Search, EyeOff, Eye, RefreshCw, ChevronDown,
  Building2, Briefcase, Users, DollarSign, TrendingUp, TrendingDown,
  Minus, Settings2,
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
    failure_reasons?: Array<{ reason?: string; count?: number }>;
  };
  rows: VerbasRow[];
}

// ─── Hierarchy node types ─────────────────────────────────────────────────────

type MonthMap = Record<typeof MONTH_COLUMNS[number], number>;

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
  benchmarkAvg: number;
  tipos: TipoNode[];
}

interface PositionNode {
  position: string;
  total: number;
  employeeCount: number;
  avgPerEmployee: number;
  employees: EmployeeNode[];
}

interface CompanyNode {
  companyId: string;
  razaoSocial: string;
  total: number;
  employeeCount: number;
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
  "SALDO_SALARIO", "COMPLEMENTO_SALARIAL", "COMISSAO_DSR", "BONUS", "PREMIO",
  "ADCNOT_HORAEXTRA_DSR", "VERBA_INDENIZATORIA", "VALE_ALIMENTACAO",
  "DESC_PLANO_SAUDE", "PLANO_SAUDE_EMPRESA", "SEGURO_VIDA", "SST", "FGTS", "OUTROS",
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
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();
  const currentYear = new Date().getFullYear();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [selectedYears, setSelectedYears] = useState<string[]>([String(currentYear)]);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [tipoVerba, setTipoVerba] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  // ── Sync state ────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [closingMonth, setClosingMonth] = useState(String(new Date().getMonth() + 1));
  const [syncSummary, setSyncSummary] = useState<VerbasResponse["sync_result"] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncChecklist, setSyncChecklist] = useState<Array<{ label: string; ok: boolean }>>([]);

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

  const { data: verbasCard, isLoading: cardLoading } = useQuery({
    queryKey: ["ec-verbas-card"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ec_cards")
        .select("id, title")
        .ilike("title", "%verbas%")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // KEY FIX: never inject selectedCompanyId — user must choose company explicitly.
  // pageSize: 1000 loads enough data to build the full 3-level hierarchy client-side.
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [
      "verbas-hierarchy-v3",
      selectedYears.join(","),
      cpf, nome, tipoVerba,
      companyFilter, positionFilter, departmentFilter,
    ],
    queryFn: async () => {
      const yearsToQuery = selectedYears.length ? selectedYears : [String(currentYear)];
      const serverPageSize = 200;
      const maxPagesPerYear = 200;

      const responses = await Promise.all(
        yearsToQuery.map(async (year) => {
          const allRows: VerbasRow[] = [];
          let responseAccess: VerbasAccess = "masked";
          let page = 1;

          while (page <= maxPagesPerYear) {
            const body: Record<string, unknown> = {
              ano: Number(year),
              autoSyncWhenEmpty: false,
              page,
              pageSize: serverPageSize,
            };
            // Only restrict by company when user explicitly selects one
            if (companyFilter !== "all") body.companyId = companyFilter;
            if (cpf.trim()) body.cpf = cpf.trim();
            if (nome.trim()) body.nome = nome.trim();
            if (tipoVerba !== "all") body.tipoVerba = tipoVerba;
            if (departmentFilter !== "all") body.department = departmentFilter;
            if (positionFilter !== "all") body.position = positionFilter;

            const { data: response, error: invokeError } = await supabase.functions.invoke(
              "verbas-secure-query",
              { body },
            );

            if (invokeError) {
              let details = invokeError.message;
              try {
                if (invokeError.context) {
                  const json = await invokeError.context.json();
                  details = json?.error || json?.message || details;
                }
              } catch { /* noop */ }
              throw new Error(details || "Falha ao consultar verbas");
            }

            const typed = (response || { rows: [], total: 0, page, pageSize: serverPageSize, access: "masked" }) as VerbasResponse;
            responseAccess = typed.access === "full" ? "full" : responseAccess;
            const currentRows = typed.rows || [];
            allRows.push(...currentRows);

            if (currentRows.length < serverPageSize) {
              break;
            }

            page += 1;
          }

          return {
            success: true,
            access: responseAccess,
            page: 1,
            pageSize: serverPageSize,
            total: allRows.length,
            rows: allRows,
          } as VerbasResponse;
        }),
      );

      return {
        success: true,
        access: responses.some((r) => r.access === "full") ? "full" : "masked",
        page: 1,
        pageSize: 1000,
        total: responses.reduce((s, r) => s + (r.total || 0), 0),
        rows: responses.flatMap((r) => r.rows || []),
      } as VerbasResponse;
    },
    enabled: !permissionsLoading && !cardLoading && !!verbasCard && hasCardPermission(verbasCard.id, "view"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const runSync = async (
    months: number[],
    modeLabel: string,
    options?: { includeFilters?: boolean; allPages?: boolean; maxPages?: number },
  ) => {
    setSyncing(true);
    setSyncError(null);
    setSyncSummary(null);
    setSyncChecklist([]);

    try {
      const targetYears = selectedYears.map(Number).filter(Number.isFinite).sort((a, b) => b - a);
      if (!targetYears.length) throw new Error("Selecione ao menos 1 ano para sincronizar.");

      const aggregate = {
        received: 0, processed: 0, failed: 0, upserted: 0, duration_ms: 0,
        failure_reasons: new Map<string, number>(),
      };

      for (const year of targetYears) {
        for (const month of months) {
          setSyncError(`${modeLabel}: sincronizando ${month}/12 de ${year}...`);

          const includeFilters = options?.includeFilters !== false;
          const allPages = options?.allPages === true;

          const body: Record<string, unknown> = {
            ano: year,
            autoSyncWhenEmpty: false,
            syncNow: true,
            syncMonth: month,
            syncAllPages: allPages,
            syncMaxPages: allPages ? 5000 : (options?.maxPages ?? 25),
            page: 1,
            pageSize: 1000,
          };

          if (includeFilters) {
            if (companyFilter !== "all") body.companyId = companyFilter;
            if (departmentFilter !== "all") body.department = departmentFilter;
            if (positionFilter !== "all") body.position = positionFilter;
          }

          const { data: response, error: invokeError } = await supabase.functions.invoke(
            "verbas-secure-query",
            { body },
          );

          if (invokeError) {
            let details = invokeError.message;
            try {
              if (invokeError.context) {
                const json = await invokeError.context.json();
                details = json?.error || json?.message || details;
              }
            } catch { /* noop */ }
            throw new Error(`Ano ${year}, mês ${month}: ${details || "Falha ao sincronizar"}`);
          }

          const typed = (response || {}) as VerbasResponse;
          const result = typed.sync_result;
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
      setSyncError(null);
      await refetch();
    } catch (err) {
      setSyncError((err as Error).message || "Erro ao sincronizar verbas");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncVerbas = () => runSync(
    [1,2,3,4,5,6,7,8,9,10,11,12],
    "Sincronização anual",
    { includeFilters: true, allPages: false, maxPages: 100 },
  );

  const handleInitialBootstrap = () => runSync(
    [1,2,3,4,5,6,7,8,9,10,11,12],
    "Carga inicial completa",
    { includeFilters: false, allPages: true, maxPages: 5000 },
  );

  const handleMonthlyClose = () => {
    const m = Number(closingMonth);
    if (!Number.isFinite(m) || m < 1 || m > 12) { setSyncError("Mês inválido."); return; }
    runSync([m], "Fechamento mensal", { includeFilters: true, allPages: false, maxPages: 25 });
  };

  // ── Filter options derived from loaded rows ───────────────────────────────
  const filterOptions = useMemo(() => {
    const companies = new Map<string, string>();
    const positions = new Set<string>();
    const departments = new Set<string>();
    for (const row of data?.rows || []) {
      if (row.company_id) companies.set(row.company_id, row.razao_social || row.company_id);
      if (row.employee_position) positions.add(row.employee_position);
      if (row.employee_department) departments.add(row.employee_department);
    }
    return {
      companies: [...companies.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      positions: [...positions].sort((a, b) => a.localeCompare(b)),
      departments: [...departments].sort((a, b) => a.localeCompare(b)),
    };
  }, [data?.rows]);

  // ── Hierarchy: EMPRESA → CARGO → FUNCIONÁRIO ─────────────────────────────
  const { companyNodes, kpi } = useMemo(() => {
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
          benchmarkAvg: 0,
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

    // Step 2: build EMPRESA → CARGO structure
    const companiesMap = new Map<string, { razaoSocial: string; positionsMap: Map<string, EmployeeNode[]> }>();
    for (const emp of employeesMap.values()) {
      if (!companiesMap.has(emp.companyId)) {
        companiesMap.set(emp.companyId, { razaoSocial: emp.razaoSocial, positionsMap: new Map() });
      }
      const co = companiesMap.get(emp.companyId)!;
      if (!co.positionsMap.has(emp.position)) co.positionsMap.set(emp.position, []);
      co.positionsMap.get(emp.position)!.push(emp);
    }

    // Step 3: compute benchmark avg per (company + position) and build final tree
    const nodes: CompanyNode[] = [];
    let totalMassa = 0;
    let totalEmployeesAll = 0;

    for (const [companyId, co] of companiesMap.entries()) {
      const positionNodes: PositionNode[] = [];
      let companyTotal = 0;
      const companyCpfs = new Set<string>();

      for (const [position, emps] of co.positionsMap.entries()) {
        const posTotal = emps.reduce((s, e) => s + e.total, 0);
        const posAvg = emps.length ? posTotal / emps.length : 0;
        // Inject benchmark avg into each employee
        for (const e of emps) e.benchmarkAvg = posAvg;
        positionNodes.push({
          position,
          total: posTotal,
          employeeCount: emps.length,
          avgPerEmployee: posAvg,
          employees: [...emps].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
        });
        companyTotal += posTotal;
        for (const e of emps) companyCpfs.add(e.cpf);
      }

      positionNodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
      nodes.push({ companyId, razaoSocial: co.razaoSocial, total: companyTotal, employeeCount: companyCpfs.size, positionNodes });
      totalMassa += companyTotal;
      totalEmployeesAll += companyCpfs.size;
    }

    nodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    return {
      companyNodes: nodes,
      kpi: {
        totalMassa,
        totalEmployees: totalEmployeesAll,
        avgPerEmployee: totalEmployeesAll > 0 ? totalMassa / totalEmployeesAll : 0,
        totalCompanies: nodes.length,
      },
    };
  }, [data?.rows]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (permissionsLoading || cardLoading) {
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

  if (verbasCard && !hasCardPermission(verbasCard.id, "view")) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Você não tem permissão para acessar VERBAS</p>
          <Button variant="outline" onClick={() => navigate("/governanca-ec/pessoas-cultura")}>
            Voltar para Pessoas &amp; Cultura
          </Button>
        </div>
      </MainLayout>
    );
  }

  const hasData = !isLoading && !error && companyNodes.length > 0;

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
                Análise de remuneração por Empresa · Cargo · Colaborador
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
            <Button variant="outline" size="sm" onClick={() => setShowSyncPanel((v) => !v)}>
              <Settings2 className="h-4 w-4 mr-1" />
              Sincronização
            </Button>
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Massa Salarial", value: isLoading ? null : formatCurrency(kpi.totalMassa, true), sub: selectedYears.join(" · "), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950" },
            { label: "Colaboradores", value: isLoading ? null : (kpi.totalEmployees || 0).toLocaleString("pt-BR"), sub: "únicos na seleção", icon: Users, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
            { label: "Média / Colaborador", value: isLoading ? null : formatCurrency(kpi.avgPerEmployee, true), sub: "no período", icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-950" },
            { label: "Empresas na visão", value: isLoading ? null : (kpi.totalCompanies || 0).toString(), sub: "com dados carregados", icon: Building2, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950" },
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
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Período</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-36 justify-between">
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
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {filterOptions.companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Cargo</p>
                <Select value={positionFilter} onValueChange={setPositionFilter}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Todos os cargos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    {filterOptions.positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Setor</p>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {filterOptions.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tipo de verba</p>
                <Select value={tipoVerba} onValueChange={setTipoVerba}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {TIPO_VERBA_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Nome</p>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Buscar nome..." className="w-48" onKeyDown={(e) => e.key === "Enter" && refetch()} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">CPF</p>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-40" onKeyDown={(e) => e.key === "Enter" && refetch()} />
              </div>
              <Button onClick={() => refetch()} disabled={isFetching} className="self-end">
                {isFetching ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Sync panel (collapsible) ────────────────────────────────────── */}
        <Collapsible open={showSyncPanel} onOpenChange={setShowSyncPanel}>
          <CollapsibleContent>
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-muted-foreground">Operações de Sincronização</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <Button variant="secondary" onClick={handleInitialBootstrap} disabled={syncing}>
                    {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Carga inicial completa (todas empresas)
                  </Button>
                  <Button variant="outline" onClick={handleSyncVerbas} disabled={syncing}>
                    {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sincronização anual (com filtros)
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
                    <Button variant="outline" onClick={handleMonthlyClose} disabled={syncing}>Fechamento mensal</Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin/datalake?tab=logs")}>Ver logs</Button>
                </div>
                {(syncError || syncSummary || syncChecklist.length > 0) && (
                  <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs">
                    {syncError && <p className="text-destructive">{syncError}</p>}
                    {syncSummary && (
                      <p className="text-muted-foreground">
                        Concluído · {syncSummary.upserted ?? 0} gravados · {syncSummary.processed ?? 0} processados · {syncSummary.failed ?? 0} falhas
                      </p>
                    )}
                    {syncChecklist.length > 0 && (
                      <p className="text-muted-foreground">
                        {syncChecklist.map((c) => `${c.ok ? "✅" : "⚠️"} ${c.label}`).join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Main hierarchy: EMPRESA → CARGO → FUNCIONÁRIO ─────────────── */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
            ) : companyNodes.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Nenhum registro encontrado.</p>
                <p className="text-xs text-muted-foreground">Ajuste os filtros e clique em Buscar.</p>
              </div>
            ) : (
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
                            {company.employeeCount} colaboradores · {company.positionNodes.length} cargos
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

                      {/* Bar chart: distribuição por cargo */}
                      {company.positionNodes.length > 1 && (
                        <div className="px-6 py-3 bg-muted/20 border-b">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição por cargo</p>
                          <div className="h-[110px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={company.positionNodes.slice(0, 12).map((p) => ({
                                  n: p.position.length > 16 ? p.position.slice(0, 14) + "…" : p.position,
                                  t: p.total,
                                  c: p.employeeCount,
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
                                  {company.positionNodes.slice(0, 12).map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* ── NÍVEL 2: CARGO ─────────────────────────────────── */}
                      <Accordion type="multiple" className="w-full">
                        {company.positionNodes.map((posNode) => {
                          const posKey = `${company.companyId}|${posNode.position}`;
                          const posShare = company.total > 0 ? (posNode.total / company.total) * 100 : 0;
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
                                      <p className="text-xs text-muted-foreground">{posShare.toFixed(1)}% da empresa</p>
                                    </div>
                                    <Badge variant="outline" className="tabular-nums text-xs">
                                      Média: {formatCurrency(posNode.avgPerEmployee, true)}
                                    </Badge>
                                  </div>
                                </div>
                              </AccordionTrigger>

                              <AccordionContent className="px-0 pb-2">
                                {/* ── NÍVEL 3: FUNCIONÁRIO ─────────────────── */}
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
                                                CPF {emp.cpf} · {emp.department} · {emp.accountingGroup}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <p className="font-semibold tabular-nums text-sm">{formatCurrency(emp.total, true)}</p>
                                              <Badge variant="secondary" className="text-xs tabular-nums">
                                                {empShare.toFixed(1)}% do cargo
                                              </Badge>
                                              <DeltaBadge value={emp.total} avg={emp.benchmarkAvg} />
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
                ))}
              </Accordion>
            )}

            {hasData && (
              <div className="px-6 py-3 border-t flex items-center justify-between bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {data?.total || 0} registros · {kpi.totalEmployees} colaboradores · {kpi.totalCompanies} empresa{kpi.totalCompanies !== 1 ? "s" : ""}
                  {(data?.total || 0) >= 1000 && (
                    <span className="ml-2 text-amber-600 font-medium">
                      · 1.000 linhas carregadas — refine os filtros para ampliar a visão
                    </span>
                  )}
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
