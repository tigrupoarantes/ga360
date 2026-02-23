import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  companies: {
    name: string;
    accounting_group_code: string | null;
    accounting_group_description: string | null;
  } | null;
  metadata?: {
    contabilizacao?: string | null;
  } | null;
  source_system?: string | null;
}

type QuantitativeMode = "company" | "accounting_group";

interface TopLevelGroup {
  id: string | null;
  name: string;
  mode: QuantitativeMode;
  count: number;
}

function normalizeGroupName(value: string | null | undefined): string {
  return (value || "").trim();
}

function getAccountingGroup(employee: Employee): { key: string; name: string } {
  const groupCode = normalizeGroupName(employee.companies?.accounting_group_code);
  const groupDescription = normalizeGroupName(employee.companies?.accounting_group_description);
  const metadataGroup = normalizeGroupName(employee.metadata?.contabilizacao);

  const name = groupDescription || metadataGroup || "Sem Grupo de Contabilização";
  const key = groupCode || name.toLowerCase();

  return { key, name };
}

export function QLPDrillDown() {
  const [drillLevel, setDrillLevel] = useState(0);
  const [quantitativeMode, setQuantitativeMode] = useState<QuantitativeMode>("company");
  const [selectedTopLevel, setSelectedTopLevel] = useState<TopLevelGroup | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["qlp-employees"],
    queryFn: async () => {
      const { data, error } = await supabaseExternal
        .from("external_employees")
        .select("id, full_name, email, position, department, unidade, company_id, source_system, metadata, companies(name, accounting_group_code, accounting_group_description)")
        .eq("is_active", true)
        .eq("source_system", "dab_api")
        .order("full_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const topLevelGroups = useMemo(() => {
    if (!employees) return [];
    const map = new Map<string, TopLevelGroup>();

    for (const employee of employees) {
      if (quantitativeMode === "company") {
        const companyName = employee.companies?.name || "Sem Empresa";
        const key = employee.company_id || `sem_empresa::${companyName}`;
        const entry = map.get(key) || { id: employee.company_id, name: companyName, mode: "company" as const, count: 0 };
        entry.count += 1;
        map.set(key, entry);
      } else {
        const group = getAccountingGroup(employee);
        const entry = map.get(group.key) || { id: group.key, name: group.name, mode: "accounting_group" as const, count: 0 };
        entry.count += 1;
        map.set(group.key, entry);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [employees, quantitativeMode]);

  const departmentGroups = useMemo(() => {
    if (!employees || !selectedTopLevel) return [];
    const filtered = employees.filter((employee) => {
      if (selectedTopLevel.mode === "company") {
        if (selectedTopLevel.id === null) {
          return employee.company_id === null;
        }
        return employee.company_id === selectedTopLevel.id;
      }

      const group = getAccountingGroup(employee);
      return group.key === selectedTopLevel.id;
    });

    const map = new Map<string, number>();
    filtered.forEach((employee) => {
      const dept = employee.department || "Sem Departamento";
      map.set(dept, (map.get(dept) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees, selectedTopLevel]);

  const filteredEmployees = useMemo(() => {
    if (!employees || !selectedTopLevel || !selectedDepartment) return [];
    return employees.filter(
      (employee) => {
        const sameTopLevel = selectedTopLevel.mode === "company"
          ? (selectedTopLevel.id === null ? employee.company_id === null : employee.company_id === selectedTopLevel.id)
          : getAccountingGroup(employee).key === selectedTopLevel.id;

        return sameTopLevel && (employee.department || "Sem Departamento") === selectedDepartment;
      }
    );
  }, [employees, selectedTopLevel, selectedDepartment]);

  const totalEmployees = employees?.length || 0;
  const uniqueTopLevel = topLevelGroups.length;
  const uniqueDepartments = useMemo(() => {
    if (!employees) return 0;
    const source = drillLevel >= 1 && selectedTopLevel
      ? employees.filter((employee) => {
          if (selectedTopLevel.mode === "company") {
            return selectedTopLevel.id === null ? employee.company_id === null : employee.company_id === selectedTopLevel.id;
          }

          return getAccountingGroup(employee).key === selectedTopLevel.id;
        })
      : employees;

    return new Set(source.map((e) => e.department || "Sem Departamento")).size;
  }, [employees, drillLevel, selectedTopLevel]);

  const uniquePositions = useMemo(() => {
    if (!employees) return 0;
    const source = drillLevel >= 1 && selectedTopLevel
      ? employees.filter((employee) => {
          if (selectedTopLevel.mode === "company") {
            return selectedTopLevel.id === null ? employee.company_id === null : employee.company_id === selectedTopLevel.id;
          }

          return getAccountingGroup(employee).key === selectedTopLevel.id;
        })
      : employees;

    return new Set(source.filter((e) => e.position).map((e) => e.position)).size;
  }, [employees, drillLevel, selectedTopLevel]);

  const currentTotal = useMemo(() => {
    if (drillLevel === 0) return totalEmployees;
    if (drillLevel === 1 && selectedTopLevel) {
      return employees?.filter((employee) => {
        if (selectedTopLevel.mode === "company") {
          return selectedTopLevel.id === null ? employee.company_id === null : employee.company_id === selectedTopLevel.id;
        }

        return getAccountingGroup(employee).key === selectedTopLevel.id;
      }).length || 0;
    }
    return filteredEmployees.length;
  }, [drillLevel, totalEmployees, selectedTopLevel, employees, filteredEmployees]);

  const handleTopLevelClick = (topLevel: TopLevelGroup) => {
    setSelectedTopLevel(topLevel);
    setDrillLevel(1);
  };

  const handleDepartmentClick = (dept: string) => {
    setSelectedDepartment(dept);
    setDrillLevel(2);
  };

  const goToLevel = (level: number) => {
    if (level === 0) {
      setSelectedTopLevel(null);
      setSelectedDepartment(null);
    } else if (level === 1) {
      setSelectedDepartment(null);
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
      {/* Breadcrumb */}
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
          {drillLevel >= 1 && selectedTopLevel && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {drillLevel === 1 ? (
                  <BreadcrumbPage>{selectedTopLevel.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink className="cursor-pointer" onClick={() => goToLevel(1)}>
                    {selectedTopLevel.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </>
          )}
          {drillLevel === 2 && selectedDepartment && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedDepartment}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-end">
        <Select
          value={quantitativeMode}
          onValueChange={(value: QuantitativeMode) => {
            setQuantitativeMode(value);
            setDrillLevel(0);
            setSelectedTopLevel(null);
            setSelectedDepartment(null);
          }}
        >
          <SelectTrigger className="w-[270px]">
            <SelectValue placeholder="Modo de visualização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company">Quantitativo por empresa</SelectItem>
            <SelectItem value="accounting_group">Quantitativo por grupo de contabilização</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{currentTotal}</p>
            <p className="text-xs text-muted-foreground">
              {drillLevel === 0 ? "Total Geral" : drillLevel === 1 ? "Total da Empresa" : "No Departamento"}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Building2 className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{drillLevel === 0 ? uniqueTopLevel : uniqueDepartments}</p>
            <p className="text-xs text-muted-foreground">
              {drillLevel === 0 ? (quantitativeMode === "company" ? "Empresas" : "Grupos de Contabilização") : "Departamentos"}
            </p>
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

      {/* Level 0: Companies */}
      {drillLevel === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topLevelGroups.map((topLevel) => (
            <Card
              key={`${topLevel.mode}::${topLevel.id ?? "null"}::${topLevel.name}`}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between"
              onClick={() => handleTopLevelClick(topLevel)}
            >
              <div className="flex items-center gap-3">
                {quantitativeMode === "company" ? (
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Layers className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-semibold">{topLevel.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {topLevel.count} funcionário{topLevel.count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {/* Level 1: Departments */}
      {drillLevel === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentGroups.map((dept) => (
            <Card
              key={dept.name}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between"
              onClick={() => handleDepartmentClick(dept.name)}
            >
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{dept.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {dept.count} funcionário{dept.count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      {/* Level 2: Employee List */}
      {drillLevel === 2 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Unidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.full_name}</TableCell>
                  <TableCell>
                    {emp.position ? (
                      <Badge variant="outline">{emp.position}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {emp.email || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {emp.unidade || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
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
