import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Search, EyeOff, Eye, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCompany } from "@/contexts/CompanyContext";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

const MONTH_COLUMNS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const TIPO_VERBA_OPTIONS = [
  "SALDO_SALARIO",
  "COMPLEMENTO_SALARIAL",
  "COMISSAO_DSR",
  "BONUS",
  "PREMIO",
  "ADCNOT_HORAEXTRA_DSR",
  "VERBA_INDENIZATORIA",
  "VALE_ALIMENTACAO",
  "DESC_PLANO_SAUDE",
  "PLANO_SAUDE_EMPRESA",
  "SEGURO_VIDA",
  "SST",
  "FGTS",
  "OUTROS",
];

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonthLabel(month: typeof MONTH_COLUMNS[number]) {
  return `${month.slice(0, 1).toUpperCase()}${month.slice(1, 3)}`;
}

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export default function VerbasPage() {
  const navigate = useNavigate();
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();
  const { selectedCompanyId } = useCompany();
  const currentYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<string[]>([String(currentYear)]);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [tipoVerba, setTipoVerba] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [accountingGroupFilter, setAccountingGroupFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("25");
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
    setPage(1);
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

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["verbas-secure-query", selectedCompanyId, selectedYears.join(","), cpf, nome, tipoVerba, companyFilter, departmentFilter, positionFilter, accountingGroupFilter, page, pageSize],
    queryFn: async () => {
      const yearsToQuery = selectedYears.length ? selectedYears : [String(currentYear)];

      const responses = await Promise.all(
        yearsToQuery.map(async (year) => {
          const body = {
            ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
            ano: Number(year),
            ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
            ...(nome.trim() ? { nome: nome.trim() } : {}),
            ...(tipoVerba !== "all" ? { tipoVerba } : {}),
            ...(companyFilter !== "all" ? { companyId: companyFilter } : {}),
            ...(departmentFilter !== "all" ? { department: departmentFilter } : {}),
            ...(positionFilter !== "all" ? { position: positionFilter } : {}),
            ...(accountingGroupFilter !== "all" ? { accountingGroup: accountingGroupFilter } : {}),
            autoSyncWhenEmpty: false,
            page,
            pageSize: Number(pageSize),
          };

          const { data: response, error: invokeError } = await supabase.functions.invoke("verbas-secure-query", {
            body,
          });

          if (invokeError) {
            let details = invokeError.message;
            try {
              if (invokeError.context) {
                const json = await invokeError.context.json();
                details = json?.error || json?.message || details;
              }
            } catch {
              // noop
            }
            throw new Error(details || "Falha ao consultar verbas");
          }

          return (response || { rows: [], total: 0, page, pageSize: Number(pageSize), access: "masked" }) as VerbasResponse;
        }),
      );

      return {
        success: true,
        access: responses.some((item) => item.access === "full") ? "full" : "masked",
        page,
        pageSize: Number(pageSize),
        total: responses.reduce((sum, item) => sum + (item.total || 0), 0),
        rows: responses.flatMap((item) => item.rows || []),
      } as VerbasResponse;
    },
    enabled: !permissionsLoading && !cardLoading && !!verbasCard && hasCardPermission(verbasCard.id, "view"),
  });

  const runSync = async (months: number[], modeLabel: string) => {
    setSyncing(true);
    setSyncError(null);
    setSyncSummary(null);
    setSyncChecklist([]);

    try {
      const targetYears = [...selectedYears]
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .sort((a, b) => b - a);

      if (!targetYears.length) {
        throw new Error("Selecione ao menos 1 ano para sincronizar.");
      }

      const aggregate = {
        received: 0,
        processed: 0,
        failed: 0,
        upserted: 0,
        duration_ms: 0,
        failure_reasons: new Map<string, number>(),
      };

      for (const year of targetYears) {
        for (const month of months) {
          setSyncError(`${modeLabel}: sincronizando ${month}/12 de ${year}...`);

          const body = {
            ...(companyFilter !== "all"
              ? { companyId: companyFilter }
              : (selectedCompanyId ? { companyId: selectedCompanyId } : {})),
            ...(Number.isFinite(year) ? { ano: year } : {}),
            ...(departmentFilter !== "all" ? { department: departmentFilter } : {}),
            ...(positionFilter !== "all" ? { position: positionFilter } : {}),
            autoSyncWhenEmpty: false,
            syncNow: true,
            syncMonth: month,
            syncMaxPages: 25,
            page: 1,
            pageSize: Number(pageSize),
          };

          const { data: response, error: invokeError } = await supabase.functions.invoke("verbas-secure-query", {
            body,
          });

          if (invokeError) {
            let details = invokeError.message;
            try {
              if (invokeError.context) {
                const json = await invokeError.context.json();
                details = json?.error || json?.message || details;
              }
            } catch {
              // noop
            }
            throw new Error(`Ano ${year}, mês ${month}: ${details || "Falha ao sincronizar verbas"}`);
          }

          const typedResponse = (response || {}) as VerbasResponse;
          const result = typedResponse.sync_result;

          aggregate.received += result?.received ?? 0;
          aggregate.processed += result?.processed ?? 0;
          aggregate.failed += result?.failed ?? 0;
          aggregate.upserted += result?.upserted ?? 0;
          aggregate.duration_ms += result?.duration_ms ?? 0;

          for (const reason of result?.failure_reasons || []) {
            const key = reason.reason || "erro";
            aggregate.failure_reasons.set(key, (aggregate.failure_reasons.get(key) || 0) + (reason.count ?? 0));
          }

          if (typedResponse.sync_error) {
            throw new Error(`Ano ${year}, mês ${month}: ${typedResponse.sync_error}`);
          }
        }
      }

      const checklist = [
        { label: "Recebeu dados da origem", ok: (aggregate.received ?? 0) > 0 },
        { label: "Processamento concluído", ok: (aggregate.processed ?? 0) >= (aggregate.upserted ?? 0) },
        { label: "Sem falhas de integração", ok: (aggregate.failed ?? 0) === 0 },
      ];

      setSyncSummary({
        received: aggregate.received,
        processed: aggregate.processed,
        failed: aggregate.failed,
        upserted: aggregate.upserted,
        duration_ms: aggregate.duration_ms,
        failure_reasons: [...aggregate.failure_reasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 10),
      });
          setSyncChecklist(checklist);
      setSyncError(null);
      setPage(1);
      await refetch();
    } catch (err) {
      setSyncError((err as Error).message || "Erro ao sincronizar verbas");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncVerbas = async () => {
    await runSync([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "Sincronização anual");
  };

  const handleMonthlyClose = async () => {
    const month = Number(closingMonth);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      setSyncError("Mês de fechamento inválido.");
      return;
    }
    await runSync([month], "Fechamento mensal");
  };

  const totalPages = useMemo(() => {
    const total = data?.total || 0;
    const size = Number(pageSize) || 25;
    return Math.max(1, Math.ceil(total / size));
  }, [data?.total, pageSize]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.rows || []) {
      if (row.company_id) map.set(row.company_id, row.razao_social || row.company_id);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.rows]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data?.rows || []) {
      if (row.employee_department) set.add(row.employee_department);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data?.rows]);

  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data?.rows || []) {
      if (row.employee_position) set.add(row.employee_position);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data?.rows]);

  const accountingGroupOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data?.rows || []) {
      if (row.employee_accounting_group) set.add(row.employee_accounting_group);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data?.rows]);

  const cascadedRows = useMemo(() => {
    type MonthValueMap = Record<typeof MONTH_COLUMNS[number], number>;
    type TipoNode = {
      tipo: string;
      total: number;
      yearsMap: Map<number, MonthValueMap>;
    };
    type EmployeeNode = {
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
      tiposMap: Map<string, TipoNode>;
    };

    const employees = new Map<string, EmployeeNode>();

    for (const row of data?.rows || []) {
      const employeeKey = [
        row.company_id,
        row.razao_social,
        row.cpf,
        row.nome_funcionario,
      ].join("|");

      if (!employees.has(employeeKey)) {
        employees.set(employeeKey, {
          key: employeeKey,
          companyId: row.company_id,
          razaoSocial: row.razao_social,
          department: row.employee_department || "Sem Setor",
          unit: row.employee_unit || "Sem Unidade",
          position: row.employee_position || "Sem Cargo",
          accountingGroup: row.employee_accounting_group || "Sem Grupo de Contabilização",
          compareGroupKey: row.compare_group_key || `${row.company_id || ""}|${String(row.employee_position || "SEM_CARGO").trim().toUpperCase()}`,
          cpf: row.cpf,
          nome: row.nome_funcionario,
          total: 0,
          tiposMap: new Map<string, TipoNode>(),
        });
      }

      const employee = employees.get(employeeKey)!;
      const tipo = row.tipo_verba || "OUTROS";

      if (!employee.tiposMap.has(tipo)) {
        employee.tiposMap.set(tipo, {
          tipo,
          total: 0,
          yearsMap: new Map<number, MonthValueMap>(),
        });
      }

      const tipoNode = employee.tiposMap.get(tipo)!;
      const rowYear = Number(row.ano);

      if (!tipoNode.yearsMap.has(rowYear)) {
        tipoNode.yearsMap.set(rowYear, {
          janeiro: 0,
          fevereiro: 0,
          marco: 0,
          abril: 0,
          maio: 0,
          junho: 0,
          julho: 0,
          agosto: 0,
          setembro: 0,
          outubro: 0,
          novembro: 0,
          dezembro: 0,
        });
      }

      const yearMonths = tipoNode.yearsMap.get(rowYear)!;

      let rowTotal = 0;
      for (const month of MONTH_COLUMNS) {
        const value = Number(row[month] ?? 0);
        if (!Number.isFinite(value) || value === 0) continue;

        yearMonths[month] += value;
        rowTotal += value;
      }

      tipoNode.total += rowTotal;
      employee.total += rowTotal;
    }

    return [...employees.values()]
      .map((employee) => ({
        ...employee,
        tipos: [...employee.tiposMap.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [data?.rows]);

  const benchmarkByCargo = useMemo(() => {
    const groupMap = new Map<string, Array<number>>();
    for (const employee of cascadedRows) {
      const list = groupMap.get(employee.compareGroupKey) || [];
      list.push(employee.total);
      groupMap.set(employee.compareGroupKey, list);
    }

    const result = new Map<string, { avg: number; count: number }>();
    for (const [key, totals] of groupMap.entries()) {
      const count = totals.length;
      const avg = count > 0 ? totals.reduce((sum, item) => sum + item, 0) / count : 0;
      result.set(key, { avg, count });
    }

    return result;
  }, [cascadedRows]);

  if (permissionsLoading || cardLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
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
            Voltar para Pessoas & Cultura
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/governanca-ec/pessoas-cultura" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">VERBAS</h1>
            <p className="text-muted-foreground mt-1">Consulta sensível de remuneração por colaborador e tipo de verba</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Ano</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-40 justify-between">
                      {yearsLabel}
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-40" align="start">
                    {availableYears.map((year) => (
                      <DropdownMenuCheckboxItem
                        key={year}
                        checked={selectedYears.includes(year)}
                        onCheckedChange={() => toggleYear(year)}
                      >
                        {year}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CPF</p>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Digite CPF" className="w-44" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Funcionário</p>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="w-56" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tipo de verba</p>
                <Select value={tipoVerba} onValueChange={setTipoVerba}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TIPO_VERBA_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Empresa</p>
                <Select value={companyFilter} onValueChange={(value) => { setCompanyFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companyOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Setor</p>
                <Select value={departmentFilter} onValueChange={(value) => { setDepartmentFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departmentOptions.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cargo</p>
                <Select value={positionFilter} onValueChange={(value) => { setPositionFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {positionOptions.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Grupo contabilização</p>
                <Select value={accountingGroupFilter} onValueChange={(value) => { setAccountingGroupFilter(value); setPage(1); }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {accountingGroupOptions.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  setPage(1);
                  refetch();
                }}
                disabled={isFetching}
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>

              <Button variant="outline" onClick={handleSyncVerbas} disabled={syncing}>
                {syncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar verbas
              </Button>

              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Mês fechamento</p>
                  <Select value={closingMonth} onValueChange={setClosingMonth}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => (
                        <SelectItem key={month} value={String(month)}>{String(month).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleMonthlyClose} disabled={syncing}>
                  Fechamento mensal
                </Button>
              </div>

              <Button variant="outline" onClick={() => navigate("/admin/datalake?tab=logs")}>
                Ver logs da sincronização
              </Button>

              {data?.access && (
                <Badge variant={data.access === "full" ? "default" : "secondary"} className="ml-auto">
                  {data.access === "full" ? (
                    <><Eye className="h-3 w-3 mr-1" /> Acesso completo</>
                  ) : (
                    <><EyeOff className="h-3 w-3 mr-1" /> Acesso mascarado</>
                  )}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando verbas...</div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
            ) : (
              <>
                {cascadedRows.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    Nenhum registro encontrado com os filtros atuais.
                  </div>
                ) : (
                  <Accordion type="multiple" className="w-full px-4">
                    {cascadedRows.map((employee) => (
                      <AccordionItem key={employee.key} value={employee.key}>
                        <AccordionTrigger className="hover:no-underline">
                          {(() => {
                            const benchmark = benchmarkByCargo.get(employee.compareGroupKey);
                            const avg = benchmark?.avg ?? 0;
                            const deltaValue = employee.total - avg;
                            const deltaPercent = avg === 0 ? null : (deltaValue / Math.abs(avg)) * 100;

                            return (
                          <div className="flex flex-1 items-center justify-between gap-3 text-left">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{employee.nome}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {employee.razaoSocial} • {employee.department} • {employee.position} • CPF {employee.cpf}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {employee.unit} • {employee.accountingGroup} • Anos: {selectedYears.join(", ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="shrink-0">
                                Total: {formatCurrency(employee.total)}
                              </Badge>
                              <Badge variant="outline" className="shrink-0">
                                Média cargo: {formatCurrency(avg)}
                              </Badge>
                              <Badge variant="outline" className="shrink-0">
                                Δ {formatCurrency(deltaValue)} ({formatPercentage(deltaPercent)})
                              </Badge>
                            </div>
                          </div>
                            );
                          })()}
                        </AccordionTrigger>
                        <AccordionContent>
                          <Accordion type="multiple" className="w-full border-l pl-4">
                            {employee.tipos.map((tipoNode) => (
                              <AccordionItem key={`${employee.key}-${tipoNode.tipo}`} value={`${employee.key}-${tipoNode.tipo}`}>
                                <AccordionTrigger className="hover:no-underline py-3">
                                  <div className="flex flex-1 items-center justify-between gap-3 text-left">
                                    <p className="text-sm font-medium truncate">{tipoNode.tipo}</p>
                                    <Badge variant="outline" className="shrink-0">
                                      {formatCurrency(tipoNode.total)}
                                    </Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  {(() => {
                                    const years = [...tipoNode.yearsMap.keys()].sort((a, b) => b - a);
                                    const colorByIndex = [
                                      "hsl(var(--chart-1))",
                                      "hsl(var(--chart-2))",
                                      "hsl(var(--chart-3))",
                                      "hsl(var(--chart-4))",
                                      "hsl(var(--chart-5))",
                                    ];

                                    const chartData = MONTH_COLUMNS.map((month, index) => {
                                      const point: Record<string, string | number | null> = {
                                        month: formatMonthLabel(month).toUpperCase(),
                                      };

                                      for (const year of years) {
                                        const months = tipoNode.yearsMap.get(year);
                                        const current = Number(months?.[month] || 0);
                                        point[`value_${year}`] = current;

                                        if (index === 0) {
                                          point[`pct_${year}`] = null;
                                          continue;
                                        }

                                        const previousMonth = MONTH_COLUMNS[index - 1];
                                        const previous = Number(months?.[previousMonth] || 0);

                                        if (previous === 0) {
                                          point[`pct_${year}`] = current === 0 ? 0 : null;
                                        } else {
                                          point[`pct_${year}`] = ((current - previous) / Math.abs(previous)) * 100;
                                        }
                                      }

                                      return point;
                                    });

                                    const summaries = years.map((year) => {
                                      const months = tipoNode.yearsMap.get(year);
                                      const values = MONTH_COLUMNS.map((month) => Number(months?.[month] || 0));
                                      const nonZeroIndexes = values
                                        .map((value, idx) => ({ value, idx }))
                                        .filter((entry) => entry.value !== 0)
                                        .map((entry) => entry.idx);

                                      const firstIndex = nonZeroIndexes[0] ?? 0;
                                      const lastIndex = nonZeroIndexes[nonZeroIndexes.length - 1] ?? MONTH_COLUMNS.length - 1;
                                      const firstValue = values[firstIndex] || 0;
                                      const lastValue = values[lastIndex] || 0;

                                      let growthPercent: number | null = null;
                                      if (firstValue === 0) {
                                        growthPercent = lastValue === 0 ? 0 : null;
                                      } else {
                                        growthPercent = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
                                      }

                                      return {
                                        year,
                                        firstMonth: formatMonthLabel(MONTH_COLUMNS[firstIndex]).toUpperCase(),
                                        lastMonth: formatMonthLabel(MONTH_COLUMNS[lastIndex]).toUpperCase(),
                                        growthValue: lastValue - firstValue,
                                        growthPercent,
                                      };
                                    });

                                    return (
                                      <div className="space-y-3">
                                        <div className="rounded-md border p-3">
                                          <div className="h-[220px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="month" />
                                                <YAxis
                                                  yAxisId="value"
                                                  tickFormatter={(value) =>
                                                    Number(value).toLocaleString("pt-BR", {
                                                      style: "currency",
                                                      currency: "BRL",
                                                      maximumFractionDigits: 0,
                                                    })
                                                  }
                                                />
                                                <YAxis
                                                  yAxisId="percent"
                                                  orientation="right"
                                                  tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                                />
                                                <Tooltip
                                                  contentStyle={{
                                                    backgroundColor: "hsl(var(--card))",
                                                    border: "1px solid hsl(var(--border))",
                                                    borderRadius: "8px",
                                                  }}
                                                  formatter={(value, name) => {
                                                    const key = String(name);
                                                    if (key.startsWith("value_")) {
                                                      const year = key.replace("value_", "");
                                                      return [formatCurrency(Number(value)), `Valor ${year}`];
                                                    }

                                                    if (key.startsWith("pct_")) {
                                                      const year = key.replace("pct_", "");
                                                      const pct = Number(value);
                                                      return [formatPercentage(Number.isFinite(pct) ? pct : null), `Variação ${year}`];
                                                    }

                                                    return [String(value), key];
                                                  }}
                                                />
                                                {years.map((year, index) => (
                                                  <Line
                                                    key={`value_${year}`}
                                                    yAxisId="value"
                                                    type="monotone"
                                                    dataKey={`value_${year}`}
                                                    stroke={colorByIndex[index % colorByIndex.length]}
                                                    strokeWidth={2}
                                                    dot={{ fill: colorByIndex[index % colorByIndex.length] }}
                                                    name={`value_${year}`}
                                                  />
                                                ))}
                                                {years.map((year, index) => (
                                                  <Line
                                                    key={`pct_${year}`}
                                                    yAxisId="percent"
                                                    type="monotone"
                                                    dataKey={`pct_${year}`}
                                                    stroke={colorByIndex[index % colorByIndex.length]}
                                                    strokeWidth={1.5}
                                                    strokeDasharray="4 4"
                                                    dot={false}
                                                    connectNulls={false}
                                                    name={`pct_${year}`}
                                                  />
                                                ))}
                                              </LineChart>
                                            </ResponsiveContainer>
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 text-xs">
                                          {summaries.map((item) => (
                                            <Badge key={`summary-${item.year}`} variant="outline">
                                              {item.year} ({item.firstMonth}→{item.lastMonth}) • Δ {formatCurrency(item.growthValue)} • {formatPercentage(item.growthPercent)}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}

                <div className="p-4 border-t flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total: {data?.total || 0} registros</p>
                    {syncSummary && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Sincronização: {syncSummary.upserted ?? 0} gravados/alterados, {syncSummary.processed ?? 0} processados, {syncSummary.failed ?? 0} falhas.
                        </p>
                        {!!syncSummary.failure_reasons?.length && (
                          <p className="text-xs text-muted-foreground">
                            Principais falhas: {syncSummary.failure_reasons.slice(0, 3).map((item) => `${item.reason || "erro"} (${item.count ?? 0})`).join(" • ")}
                          </p>
                        )}
                      </>
                    )}
                    {syncError && (
                      <p className="text-xs text-destructive">
                        Status da sincronização: {syncError}
                      </p>
                    )}
                    {!!syncChecklist.length && (
                      <p className="text-xs text-muted-foreground">
                        Checklist: {syncChecklist.map((item) => `${item.ok ? "✅" : "⚠️"} ${item.label}`).join(" • ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">{page}/{totalPages}</span>
                    <Button variant="outline" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
