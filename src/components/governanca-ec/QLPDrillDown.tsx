import { useMemo, useState } from "react";
import { TurnoverAnalytics } from "./TurnoverAnalytics";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Users, Building2, Briefcase, ChevronRight, Layers } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  gender: string | null;
  age: number | null;
  birth_date: string | null;
  hire_date: string | null;
  position: string | null;
  department: string | null;
  unidade: string | null;
  is_active: boolean | null;
  is_disabled: boolean | null;
  company_id: string | null;
  contract_company_id: string | null;
  accounting_company_id: string | null;
  accounting_group: string | null;
  contract_company: {
    name: string;
  } | null;
  accounting_company: {
    name: string;
  } | null;
  termination_date: string | null;
  lider_direto_id: string | null;
  lider_direto: { id: string; full_name: string } | null;
  metadata?: Record<string, unknown> | null;
}

type ViewMode = "cnpj" | "accounting";

interface GroupItem {
  id: string | null;
  name: string;
  count: number;
}

const ACCOUNTING_CODE_TO_NAME: Record<string, string> = {
  "9": "CHOK AGRO",
  "3": "CHOK DISTRIBUIDORA",
  "4": "BROKER J. ARANTES",
  "5": "LOJAS CHOKDOCE",
  "8": "ESCRITORIO CENTRAL",
  "11": "G4 DISTRIBUIDORA",
};

function normalizeCodeDigits(value: string | number | null | undefined): string {
  const raw = String(value || "").trim();
  return raw.replace(/\D/g, "");
}

function normalizeLabel(value: string | null | undefined): string {
  return (value || "").trim();
}

function getAccountingLabel(employee: Employee): string {
  const metadataCode = typeof employee.metadata?.cod_contabilizacao === "string"
    ? employee.metadata.cod_contabilizacao
    : typeof employee.metadata?.cod_contabilizacao === "number"
      ? String(employee.metadata.cod_contabilizacao)
      : null;

  const code = normalizeCodeDigits(metadataCode);
  if (code && ACCOUNTING_CODE_TO_NAME[code]) {
    return ACCOUNTING_CODE_TO_NAME[code];
  }

  const group = normalizeLabel(employee.accounting_group);
  if (group) return group;

  const metadataGroup = normalizeLabel(typeof employee.metadata?.contabilizacao === "string" ? employee.metadata.contabilizacao : null);
  if (metadataGroup) return metadataGroup;

  return "Sem Grupo de Contabilização";
}

function normalizeGender(value: string | null | undefined): "Masculino" | "Feminino" | "Não informado" {
  const normalized = (value || "").trim().toUpperCase();
  if (!normalized) return "Não informado";
  if (normalized === "M" || normalized === "MASCULINO") return "Masculino";
  if (normalized === "F" || normalized === "FEMININO") return "Feminino";
  return "Não informado";
}

function calculateAgeFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

const AGE_BUCKETS = [
  { key: "18-20", label: "18-20", min: 18, max: 20 },
  { key: "21-30", label: "21-30", min: 21, max: 30 },
  { key: "31-40", label: "31-40", min: 31, max: 40 },
  { key: "41-50", label: "41-50", min: 41, max: 50 },
  { key: "51-60", label: "51-60", min: 51, max: 60 },
  { key: "61+", label: "61+", min: 61, max: Number.POSITIVE_INFINITY },
];

function isEmployeeOnLeave(employee: Employee): boolean {
  const metadata = employee.metadata;
  if (!metadata || typeof metadata !== "object") return false;

  const afastadoFlags = ["afastado", "is_afastado", "afastamento", "is_away"];
  for (const key of afastadoFlags) {
    const value = metadata[key];
    if (value === true) return true;
    if (typeof value === "string" && ["sim", "true", "1", "afastado"].includes(value.trim().toLowerCase())) {
      return true;
    }
  }

  const statusKeys = ["status", "situacao", "status_funcionario", "employee_status"];
  for (const key of statusKeys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["afastado", "licenca", "licença", "encostado"].includes(normalized)) {
        return true;
      }
    }
  }

  return false;
}

function getTopCompany(employee: Employee, mode: ViewMode): { id: string | null; name: string } {
  if (mode === "accounting") {
    const accountingLabel = getAccountingLabel(employee);
    return {
      id: accountingLabel,
      name: accountingLabel,
    };
  }

  const contractId = employee.contract_company_id || employee.company_id || null;
  return {
    id: contractId,
    name: employee.contract_company?.name || "Sem Empresa Contrato",
  };
}

function getCompanyKey(company: { id: string | null; name: string }): string {
  return company.id || `sem_empresa::${company.name}`;
}

function getCompanyKeyByEmployee(employee: Employee, mode: ViewMode): string {
  return getCompanyKey(getTopCompany(employee, mode));
}

export function QLPDrillDown() {
  const [viewMode, setViewMode] = useState<ViewMode>("accounting");
  const [drillLevel, setDrillLevel] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<GroupItem | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [analyticsCompanyKey, setAnalyticsCompanyKey] = useState<string>("all");
  const [analyticsPeriod, setAnalyticsPeriod] = useState<string>("all");

  const { data: employees, isLoading } = useQuery({
    queryKey: ["qlp-employees-all", viewMode],
    queryFn: async () => {
      const { data, error } = await supabaseExternal
        .from("external_employees")
        .select("id, full_name, email, gender, age, birth_date, hire_date, position, department, unidade, is_active, is_disabled, company_id, contract_company_id, accounting_company_id, accounting_group, termination_date, lider_direto_id, metadata, contract_company:companies!contract_company_id(name), accounting_company:companies!accounting_company_id(name), lider_direto:external_employees!lider_direto_id(id, full_name)")
        .eq("source_system", "dab_api")
        .order("full_name");

      if (error) throw error;
      // PostgREST retorna arrays para joins ambíguos — normalizar para objeto singular
      return (data ?? []).map((row: any) => ({
        ...row,
        contract_company: Array.isArray(row.contract_company) ? row.contract_company[0] ?? null : row.contract_company,
        accounting_company: Array.isArray(row.accounting_company) ? row.accounting_company[0] ?? null : row.accounting_company,
        lider_direto: Array.isArray(row.lider_direto) ? row.lider_direto[0] ?? null : row.lider_direto,
      })) as Employee[];
    },
  });

  const activeEmployees = useMemo(() =>
    employees?.filter(e => e.is_active !== false) || [],
    [employees]
  );

  const topLevelGroups = useMemo(() => {
    if (!activeEmployees.length) return [];

    const map = new Map<string, GroupItem>();

    for (const employee of activeEmployees) {
      const company = getTopCompany(employee, viewMode);
      const key = getCompanyKey(company);
      const current = map.get(key) || { id: company.id, name: company.name, count: 0 };
      current.count += 1;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [activeEmployees, viewMode]);

  const employeesInCompany = useMemo(() => {
    if (!activeEmployees.length || !selectedCompany) return [];

    return activeEmployees.filter((employee) => {
      const company = getTopCompany(employee, viewMode);
      return selectedCompany.id === null ? company.id === null : company.id === selectedCompany.id;
    });
  }, [activeEmployees, selectedCompany, viewMode]);

  const unitGroups = useMemo(() => {
    const map = new Map<string, number>();

    for (const employee of employeesInCompany) {
      const unit = employee.unidade || "Sem Unidade";
      map.set(unit, (map.get(unit) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employeesInCompany]);

  const employeesInUnit = useMemo(() => {
    if (!selectedUnit) return [];

    return employeesInCompany.filter((employee) => (employee.unidade || "Sem Unidade") === selectedUnit);
  }, [employeesInCompany, selectedUnit]);

  const finalEmployees = useMemo(() => employeesInUnit, [employeesInUnit]);

  const contextEmployees = useMemo(() => {
    if (!activeEmployees.length) return [];
    if (drillLevel === 0) return activeEmployees;
    if (drillLevel === 1) return employeesInCompany;
    return finalEmployees;
  }, [activeEmployees, drillLevel, employeesInCompany, finalEmployees]);

  const analyticsEmployees = useMemo(() => {
    if (!employees) return [];

    let filtered = [...employees];

    if (analyticsCompanyKey !== "all") {
      filtered = filtered.filter((employee) => {
        return getCompanyKeyByEmployee(employee, viewMode) === analyticsCompanyKey;
      });
    }

    if (analyticsPeriod !== "all") {
      const months = Number(analyticsPeriod);
      if (Number.isFinite(months) && months > 0) {
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - months);

        filtered = filtered.filter((employee) => {
          if (!employee.hire_date) return false;
          const hireDate = new Date(employee.hire_date);
          if (Number.isNaN(hireDate.getTime())) return false;
          return hireDate >= threshold;
        });
      }
    }

    return filtered;
  }, [employees, analyticsCompanyKey, analyticsPeriod, viewMode]);

  const genderData = useMemo(() => {
    const counts = {
      Masculino: 0,
      Feminino: 0,
      "Não informado": 0,
    };

    for (const employee of analyticsEmployees) {
      const gender = normalizeGender(employee.gender);
      counts[gender] += 1;
    }

    return [
      { name: "Masculino", value: counts.Masculino, fill: "hsl(var(--chart-1))" },
      { name: "Feminino", value: counts.Feminino, fill: "hsl(var(--chart-2))" },
      { name: "Não informado", value: counts["Não informado"], fill: "hsl(var(--chart-5))" },
    ];
  }, [analyticsEmployees]);

  const ageRangeData = useMemo(() => {
    const rangeCount = new Map<string, number>();
    AGE_BUCKETS.forEach((bucket) => rangeCount.set(bucket.key, 0));

    for (const employee of analyticsEmployees) {
      if (employee.is_active === false) continue;

      const age = employee.age ?? calculateAgeFromBirthDate(employee.birth_date);
      if (age === null) continue;

      const bucket = AGE_BUCKETS.find((item) => age >= item.min && age <= item.max);
      if (bucket) {
        rangeCount.set(bucket.key, (rangeCount.get(bucket.key) || 0) + 1);
      }
    }

    return AGE_BUCKETS.map((bucket) => ({
      faixa: bucket.label,
      total: rangeCount.get(bucket.key) || 0,
    }));
  }, [analyticsEmployees]);

  const roleByGenderData = useMemo(() => {
    const map = new Map<string, { role: string; feminino: number; masculino: number; naoInformado: number; total: number }>();

    for (const employee of analyticsEmployees) {
      const role = employee.position || "Sem Cargo";
      const current = map.get(role) || { role, feminino: 0, masculino: 0, naoInformado: 0, total: 0 };
      const gender = normalizeGender(employee.gender);

      if (gender === "Feminino") current.feminino += 1;
      else if (gender === "Masculino") current.masculino += 1;
      else current.naoInformado += 1;

      current.total += 1;
      map.set(role, current);
    }

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [analyticsEmployees]);

  const disabledCount = useMemo(() => analyticsEmployees.filter((employee) => employee.is_disabled === true).length, [analyticsEmployees]);

  const leaveCount = useMemo(() => analyticsEmployees.filter((employee) => isEmployeeOnLeave(employee)).length, [analyticsEmployees]);

  const leaveDataCoverage = useMemo(() => {
    return analyticsEmployees.some((employee) => {
      const metadata = employee.metadata;
      if (!metadata || typeof metadata !== "object") return false;
      return ["afastado", "is_afastado", "afastamento", "status", "situacao", "status_funcionario", "employee_status"].some(
        (key) => metadata[key] !== undefined,
      );
    });
  }, [analyticsEmployees]);

  const leaderData = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const e of analyticsEmployees) {
      if (!e.lider_direto) continue;
      const key = e.lider_direto.id;
      const cur = map.get(key) || { name: e.lider_direto.full_name, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [analyticsEmployees]);

  const chartTickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };
  const legendStyle = { color: "hsl(var(--foreground))" };
  const tooltipContentStyle = {
    backgroundColor: "hsl(var(--popover))",
    borderColor: "hsl(var(--border))",
    borderRadius: "0.5rem",
    color: "hsl(var(--popover-foreground))",
  };

  const chartColors = {
    male: "hsl(var(--chart-1))",
    female: "hsl(var(--chart-2))",
    unknown: "hsl(var(--chart-5))",
    age: "hsl(var(--chart-3))",
    grid: "hsl(var(--border))",
  };

  const currentTotal = useMemo(() => {
    if (drillLevel === 0) return employees?.length || 0;
    if (drillLevel === 1) return employeesInCompany.length;
    return finalEmployees.length;
  }, [drillLevel, employees, employeesInCompany.length, finalEmployees.length]);

  const uniqueUnits = useMemo(() => {
    const source = drillLevel === 0 ? (employees || []) : employeesInCompany;
    return new Set(source.map((employee) => employee.unidade || "Sem Unidade")).size;
  }, [drillLevel, employees, employeesInCompany]);

  const uniquePositions = useMemo(() => {
    const source = drillLevel === 0 ? (employees || []) : drillLevel === 1 ? employeesInCompany : finalEmployees;
    return new Set(source.map((employee) => employee.position || "Sem Cargo")).size;
  }, [drillLevel, employees, employeesInCompany, finalEmployees]);

  const goToLevel = (level: number) => {
    if (level === 0) {
      setSelectedCompany(null);
      setSelectedUnit(null);
      setAnalyticsCompanyKey("all");
    }

    if (level === 1) {
      setSelectedUnit(null);
      if (selectedCompany) {
        setAnalyticsCompanyKey(getCompanyKey(selectedCompany));
      }
    }

    setDrillLevel(level);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {drillLevel === 0 ? (
              <BreadcrumbPage>Total Geral</BreadcrumbPage>
            ) : (
              <BreadcrumbLink className="cursor-pointer" onClick={() => goToLevel(0)}>
                Total Geral
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>

          {drillLevel >= 1 && selectedCompany && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {drillLevel === 1 ? (
                  <BreadcrumbPage>{selectedCompany.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink className="cursor-pointer" onClick={() => goToLevel(1)}>
                    {selectedCompany.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </>
          )}

          {drillLevel >= 2 && selectedUnit && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedUnit}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-end">
        <Select
          value={viewMode}
          onValueChange={(value: ViewMode) => {
            setViewMode(value);
            setDrillLevel(0);
            setSelectedCompany(null);
            setSelectedUnit(null);
            setAnalyticsCompanyKey("all");
          }}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Modo de visualização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cnpj">Por CNPJ</SelectItem>
            <SelectItem value="accounting">Por Contabilização</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{currentTotal}</p>
            <p className="text-xs text-muted-foreground">{drillLevel === 0 ? "Total Geral" : "No Contexto"}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Building2 className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{drillLevel === 0 ? topLevelGroups.length : uniqueUnits}</p>
            <p className="text-xs text-muted-foreground">{drillLevel === 0 ? "Empresas" : "Unidades"}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Layers className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{uniqueUnits}</p>
            <p className="text-xs text-muted-foreground">Unidades</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Briefcase className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{uniquePositions}</p>
            <p className="text-xs text-muted-foreground">Cargos Únicos</p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Indicadores Qualitativos</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={analyticsCompanyKey} onValueChange={setAnalyticsCompanyKey}>
            <SelectTrigger>
              <SelectValue placeholder="Empresa (gráficos)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas empresas</SelectItem>
              {topLevelGroups.map((company) => {
                const key = getCompanyKey(company);
                return (
                  <SelectItem key={key} value={key}>
                    {company.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={analyticsPeriod} onValueChange={setAnalyticsPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Período completo</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
              <SelectItem value="36">Últimos 36 meses</SelectItem>
            </SelectContent>
          </Select>

          <Card className="p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Base dos gráficos</span>
            <span className="text-lg font-semibold">{analyticsEmployees.length}</span>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAnalyticsCompanyKey(drillLevel >= 1 && selectedCompany ? getCompanyKey(selectedCompany) : "all");
              setAnalyticsPeriod("all");
            }}
          >
            Limpar filtros
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Distribuição por gênero</p>
            <p className="text-xs text-muted-foreground mb-2">Base filtrada: {analyticsEmployees.length} colaborador(es)</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {genderData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value}`, "Quantidade"]} contentStyle={tooltipContentStyle} />
                  <Legend wrapperStyle={legendStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Funcionários ativos por faixa etária</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageRangeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="faixa" tick={chartTickStyle} axisLine={{ stroke: chartColors.grid }} tickLine={{ stroke: chartColors.grid }} />
                  <YAxis allowDecimals={false} tick={chartTickStyle} axisLine={{ stroke: chartColors.grid }} tickLine={{ stroke: chartColors.grid }} />
                  <Tooltip formatter={(value: number) => [`${value}`, "Ativos"]} contentStyle={tooltipContentStyle} />
                  <Bar dataKey="total" fill={chartColors.age} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="p-4 xl:col-span-2">
            <p className="text-sm text-muted-foreground mb-2">Cargos por gênero (Top 10)</p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleByGenderData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="role"
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={70}
                    tick={chartTickStyle}
                    axisLine={{ stroke: chartColors.grid }}
                    tickLine={{ stroke: chartColors.grid }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={chartTickStyle}
                    axisLine={{ stroke: chartColors.grid }}
                    tickLine={{ stroke: chartColors.grid }}
                  />
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="feminino" name="Feminino" fill={chartColors.female} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="masculino" name="Masculino" fill={chartColors.male} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="naoInformado" name="Não informado" fill={chartColors.unknown} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Funcionários PCD</p>
              <p className="text-3xl font-bold mt-2">{disabledCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {analyticsEmployees.length > 0 ? `${((disabledCount / analyticsEmployees.length) * 100).toFixed(1)}% da base filtrada` : "Sem dados na base filtrada"}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Funcionários afastados</p>
              <p className="text-3xl font-bold mt-2">{leaveCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {leaveDataCoverage
                  ? "Detectado via metadados de status/afastamento"
                  : "Sem campo explícito de afastamento na base atual"}
              </p>
            </Card>
          </div>

          {leaderData.length > 0 && (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-2">Headcount por Líder (Top 15)</p>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaderData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={chartTickStyle} axisLine={{ stroke: chartColors.grid }} tickLine={{ stroke: chartColors.grid }} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ ...chartTickStyle, fontSize: 11 }} axisLine={{ stroke: chartColors.grid }} tickLine={{ stroke: chartColors.grid }} />
                    <Tooltip formatter={(value: number) => [`${value}`, "Subordinados"]} contentStyle={tooltipContentStyle} />
                    <Bar dataKey="count" name="Subordinados" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      </div>

      <TurnoverAnalytics employees={employees || []} />

      {drillLevel === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevelGroups.map((company) => (
            <Card
              key={`${company.id ?? "null"}::${company.name}`}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedCompany(company);
                setSelectedUnit(null);
                setDrillLevel(1);
                setAnalyticsCompanyKey(getCompanyKey(company));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedCompany(company);
                  setSelectedUnit(null);
                  setDrillLevel(1);
                  setAnalyticsCompanyKey(getCompanyKey(company));
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{company.name}</p>
                  <p className="text-sm text-muted-foreground">{company.count} funcionário{company.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {drillLevel === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unitGroups.map((unit) => (
            <Card
              key={unit.name}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedUnit(unit.name);
                setDrillLevel(2);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedUnit(unit.name);
                  setDrillLevel(2);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{unit.name}</p>
                  <p className="text-sm text-muted-foreground">{unit.count} funcionário{unit.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {drillLevel === 2 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Funcionário</TableHead>
                <TableHead className="hidden md:table-cell">Cargo</TableHead>
                <TableHead className="hidden md:table-cell">Unidade</TableHead>
                <TableHead className="hidden md:table-cell">Setor</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.position || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.unidade || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.department || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.email || "—"}</TableCell>
                </TableRow>
              ))}

              {finalEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum funcionário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
