import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, Search, Download, RefreshCw, Building2, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ExternalEmployee {
  id: string;
  external_id: string;
  source_system: string;
  registration_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  is_active: boolean;
  synced_at: string;
  created_at: string;
}

export function ExternalEmployeesList() {
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<ExternalEmployee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<ExternalEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchEmployees();
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, departmentFilter, statusFilter]);

  const fetchEmployees = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('external_employees')
        .select('*')
        .eq('company_id', selectedCompanyId)
        .order('full_name', { ascending: true });

      if (error) throw error;

      setEmployees(data || []);

      // Extract unique departments
      const uniqueDepts = [...new Set(data?.map(e => e.department).filter(Boolean) as string[])];
      setDepartments(uniqueDepts.sort());

      // Get last sync time
      if (data && data.length > 0) {
        const latestSync = data.reduce((latest, emp) => 
          new Date(emp.synced_at) > new Date(latest.synced_at) ? emp : latest
        );
        setLastSync(latestSync.synced_at);
      }
    } catch (error) {
      console.error('Error fetching external employees:', error);
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.full_name.toLowerCase().includes(term) ||
        e.email?.toLowerCase().includes(term) ||
        e.registration_number?.toLowerCase().includes(term) ||
        e.external_id.toLowerCase().includes(term)
      );
    }

    if (departmentFilter !== "all") {
      filtered = filtered.filter(e => e.department === departmentFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(e => 
        statusFilter === "active" ? e.is_active : !e.is_active
      );
    }

    setFilteredEmployees(filtered);
  };

  const exportToCsv = () => {
    const headers = ['Matrícula', 'Nome', 'Email', 'Telefone', 'Departamento', 'Cargo', 'Data Admissão', 'Status'];
    const rows = filteredEmployees.map(e => [
      e.registration_number || '',
      e.full_name,
      e.email || '',
      e.phone || '',
      e.department || '',
      e.position || '',
      e.hire_date ? format(new Date(e.hire_date), 'dd/MM/yyyy') : '',
      e.is_active ? 'Ativo' : 'Inativo'
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `funcionarios_externos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exportação concluída');
  };

  if (!selectedCompanyId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Funcionários Externos
            </CardTitle>
            <CardDescription>
              {lastSync 
                ? `Última sincronização: ${formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR })}`
                : 'Aguardando sincronização'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchEmployees}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCsv} disabled={filteredEmployees.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{employees.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{employees.filter(e => e.is_active).length}</div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{employees.filter(e => !e.is_active).length}</div>
            <div className="text-xs text-muted-foreground">Inativos</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{departments.length}</div>
            <div className="text-xs text-muted-foreground">Departamentos</div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{employees.length === 0 ? 'Nenhum funcionário sincronizado ainda' : 'Nenhum resultado encontrado'}</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-mono text-sm">
                      {employee.registration_number || employee.external_id}
                    </TableCell>
                    <TableCell className="font-medium">{employee.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.email || '-'}
                    </TableCell>
                    <TableCell>
                      {employee.department ? (
                        <Badge variant="outline" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {employee.department}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {employee.position ? (
                        <Badge variant="secondary" className="gap-1">
                          <Briefcase className="h-3 w-3" />
                          {employee.position}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.hire_date 
                        ? format(new Date(employee.hire_date), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? "default" : "secondary"}>
                        {employee.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredEmployees.length > 0 && (
          <div className="text-sm text-muted-foreground mt-4 text-center">
            Exibindo {filteredEmployees.length} de {employees.length} funcionários
          </div>
        )}
      </CardContent>
    </Card>
  );
}
