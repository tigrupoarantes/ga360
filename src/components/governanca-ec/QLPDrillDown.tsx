import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  companies: { name: string } | null;
  source_system?: string | null;
}

export function QLPDrillDown() {
  const [drillLevel, setDrillLevel] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<{ id: string | null; name: string } | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["qlp-employees"],
    queryFn: async () => {
      const { data, error } = await supabaseExternal
        .from("external_employees")
        .select("id, full_name, email, position, department, unidade, company_id, source_system, companies(name)")
        .eq("is_active", true)
        .eq("source_system", "dab_api")
        .order("full_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const companyGroups = useMemo(() => {
    if (!employees) return [];
    const map = new Map<string, { id: string | null; name: string; count: number }>();
    employees.forEach((e) => {
      const companyName = e.companies?.name || "Sem Empresa";
      const key = e.company_id || `sem_empresa::${companyName}`;
      const entry = map.get(key) || { id: e.company_id, name: companyName, count: 0 };
      entry.count++;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [employees]);

  const departmentGroups = useMemo(() => {
    if (!employees || !selectedCompany) return [];
    const filtered = employees.filter((e) => {
      if (selectedCompany.id === null) {
        return e.company_id === null;
      }
      return e.company_id === selectedCompany.id;
    });
    const map = new Map<string, number>();
    filtered.forEach((e) => {
      const dept = e.department || "Sem Departamento";
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees, selectedCompany]);

  const filteredEmployees = useMemo(() => {
    if (!employees || !selectedCompany || !selectedDepartment) return [];
    return employees.filter(
      (e) => {
        const sameCompany = selectedCompany.id === null ? e.company_id === null : e.company_id === selectedCompany.id;
        return sameCompany && (e.department || "Sem Departamento") === selectedDepartment;
      }
    );
  }, [employees, selectedCompany, selectedDepartment]);

  const totalEmployees = employees?.length || 0;
  const uniqueCompanies = companyGroups.length;
  const uniqueDepartments = useMemo(() => {
    if (!employees) return 0;
    const source = drillLevel >= 1 && selectedCompany
      ? employees.filter((e) => (selectedCompany.id === null ? e.company_id === null : e.company_id === selectedCompany.id))
      : employees;
    return new Set(source.map((e) => e.department || "Sem Departamento")).size;
  }, [employees, drillLevel, selectedCompany]);
  const uniquePositions = useMemo(() => {
    if (!employees) return 0;
    const source = drillLevel >= 1 && selectedCompany
      ? employees.filter((e) => (selectedCompany.id === null ? e.company_id === null : e.company_id === selectedCompany.id))
      : employees;
    return new Set(source.filter((e) => e.position).map((e) => e.position)).size;
  }, [employees, drillLevel, selectedCompany]);

  const currentTotal = useMemo(() => {
    if (drillLevel === 0) return totalEmployees;
    if (drillLevel === 1 && selectedCompany) {
      return employees?.filter((e) => (selectedCompany.id === null ? e.company_id === null : e.company_id === selectedCompany.id)).length || 0;
    }
    return filteredEmployees.length;
  }, [drillLevel, totalEmployees, selectedCompany, employees, filteredEmployees]);

  const handleCompanyClick = (company: { id: string | null; name: string }) => {
    setSelectedCompany(company);
    setDrillLevel(1);
  };

  const handleDepartmentClick = (dept: string) => {
    setSelectedDepartment(dept);
    setDrillLevel(2);
  };

  const goToLevel = (level: number) => {
    if (level === 0) {
      setSelectedCompany(null);
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
            <p className="text-2xl font-bold">{drillLevel === 0 ? uniqueCompanies : uniqueDepartments}</p>
            <p className="text-xs text-muted-foreground">
              {drillLevel === 0 ? "Empresas" : "Departamentos"}
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
          {companyGroups.map((company) => (
            <Card
              key={company.id}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between"
              onClick={() => handleCompanyClick(company)}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{company.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {company.count} funcionário{company.count !== 1 ? "s" : ""}
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
