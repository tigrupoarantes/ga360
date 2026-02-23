import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
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

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  position: string | null;
  department: string | null;
  unidade: string | null;
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
  metadata?: {
    cod_contabilizacao?: string | null;
    contabilizacao?: string | null;
  } | null;
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
  const code = normalizeCodeDigits(employee.metadata?.cod_contabilizacao);
  if (code && ACCOUNTING_CODE_TO_NAME[code]) {
    return ACCOUNTING_CODE_TO_NAME[code];
  }

  const group = normalizeLabel(employee.accounting_group);
  if (group) return group;

  const metadataGroup = normalizeLabel(employee.metadata?.contabilizacao);
  if (metadataGroup) return metadataGroup;

  return "Sem Grupo de Contabilização";
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

export function QLPDrillDown() {
  const [viewMode, setViewMode] = useState<ViewMode>("accounting");
  const [drillLevel, setDrillLevel] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<GroupItem | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["qlp-employees", viewMode],
    queryFn: async () => {
      const { data, error } = await supabaseExternal
        .from("external_employees")
        .select("id, full_name, email, position, department, unidade, company_id, contract_company_id, accounting_company_id, accounting_group, metadata, contract_company:companies!external_employees_contract_company_id_fkey(name), accounting_company:companies!external_employees_accounting_company_id_fkey(name)")
        .eq("is_active", true)
        .eq("source_system", "dab_api")
        .order("full_name");

      if (error) throw error;
      return data as Employee[];
    },
  });

  const topLevelGroups = useMemo(() => {
    if (!employees) return [];

    const map = new Map<string, GroupItem>();

    for (const employee of employees) {
      const company = getTopCompany(employee, viewMode);
      const key = company.id || `sem_empresa::${company.name}`;
      const current = map.get(key) || { id: company.id, name: company.name, count: 0 };
      current.count += 1;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [employees, viewMode]);

  const employeesInCompany = useMemo(() => {
    if (!employees || !selectedCompany) return [];

    return employees.filter((employee) => {
      const company = getTopCompany(employee, viewMode);
      return selectedCompany.id === null ? company.id === null : company.id === selectedCompany.id;
    });
  }, [employees, selectedCompany, viewMode]);

  const departmentGroups = useMemo(() => {
    const map = new Map<string, number>();

    for (const employee of employeesInCompany) {
      const department = employee.department || "Sem Departamento";
      map.set(department, (map.get(department) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employeesInCompany]);

  const employeesInDepartment = useMemo(() => {
    if (!selectedDepartment) return [];

    return employeesInCompany.filter((employee) => (employee.department || "Sem Departamento") === selectedDepartment);
  }, [employeesInCompany, selectedDepartment]);

  const positionGroups = useMemo(() => {
    const map = new Map<string, number>();

    for (const employee of employeesInDepartment) {
      const position = employee.position || "Sem Cargo";
      map.set(position, (map.get(position) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employeesInDepartment]);

  const finalEmployees = useMemo(() => {
    if (!selectedPosition) return [];

    return employeesInDepartment.filter((employee) => (employee.position || "Sem Cargo") === selectedPosition);
  }, [employeesInDepartment, selectedPosition]);

  const currentTotal = useMemo(() => {
    if (drillLevel === 0) return employees?.length || 0;
    if (drillLevel === 1) return employeesInCompany.length;
    if (drillLevel === 2) return employeesInDepartment.length;
    return finalEmployees.length;
  }, [drillLevel, employees, employeesInCompany.length, employeesInDepartment.length, finalEmployees.length]);

  const uniqueDepartments = useMemo(() => {
    const source = drillLevel === 0 ? (employees || []) : employeesInCompany;
    return new Set(source.map((employee) => employee.department || "Sem Departamento")).size;
  }, [drillLevel, employees, employeesInCompany]);

  const uniquePositions = useMemo(() => {
    const source = drillLevel <= 1 ? employeesInCompany : employeesInDepartment;
    return new Set(source.map((employee) => employee.position || "Sem Cargo")).size;
  }, [drillLevel, employeesInCompany, employeesInDepartment]);

  const goToLevel = (level: number) => {
    if (level === 0) {
      setSelectedCompany(null);
      setSelectedDepartment(null);
      setSelectedPosition(null);
    }

    if (level === 1) {
      setSelectedDepartment(null);
      setSelectedPosition(null);
    }

    if (level === 2) {
      setSelectedPosition(null);
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

          {drillLevel >= 2 && selectedDepartment && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {drillLevel === 2 ? (
                  <BreadcrumbPage>{selectedDepartment}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink className="cursor-pointer" onClick={() => goToLevel(2)}>
                    {selectedDepartment}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </>
          )}

          {drillLevel >= 3 && selectedPosition && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedPosition}</BreadcrumbPage>
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
            setSelectedDepartment(null);
            setSelectedPosition(null);
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
            <p className="text-2xl font-bold">{drillLevel === 0 ? topLevelGroups.length : uniqueDepartments}</p>
            <p className="text-xs text-muted-foreground">{drillLevel === 0 ? "Empresas" : "Departamentos"}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Layers className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{uniqueDepartments}</p>
            <p className="text-xs text-muted-foreground">Departamentos</p>
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

      {drillLevel === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevelGroups.map((company) => (
            <Card
              key={`${company.id ?? "null"}::${company.name}`}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between"
              onClick={() => {
                setSelectedCompany(company);
                setSelectedDepartment(null);
                setSelectedPosition(null);
                setDrillLevel(1);
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
          {departmentGroups.map((department) => (
            <Card
              key={department.name}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between"
              onClick={() => {
                setSelectedDepartment(department.name);
                setSelectedPosition(null);
                setDrillLevel(2);
              }}
            >
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{department.name}</p>
                  <p className="text-sm text-muted-foreground">{department.count} funcionário{department.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {drillLevel === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {positionGroups.map((position) => (
            <Card
              key={position.name}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between"
              onClick={() => {
                setSelectedPosition(position.name);
                setDrillLevel(3);
              }}
            >
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{position.name}</p>
                  <p className="text-sm text-muted-foreground">{position.count} funcionário{position.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {drillLevel === 3 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Funcionário</TableHead>
                <TableHead className="hidden md:table-cell">Cargo</TableHead>
                <TableHead className="hidden md:table-cell">Setor</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.position || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.department || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.email || "—"}</TableCell>
                </TableRow>
              ))}

              {finalEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
