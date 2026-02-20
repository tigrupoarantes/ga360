import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/external-client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, Search, Download, RefreshCw, Building2, Briefcase, Link2, Link2Off, Loader2, MapPin, UserCircle, UserPlus, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ConvertToUsersDialog } from "./ConvertToUsersDialog";
import { ImportEmployeesDialog } from "./ImportEmployeesDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
import { syncEmployeesFromDab } from "@/services/employeesApiSource";

interface LinkedProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface LeaderProfile {
  id: string;
  full_name: string;
}

interface Company {
  id: string;
  name: string;
}

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
  linked_profile_id: string | null;
  profiles: LinkedProfile | null;
  company_id: string | null;
  companies?: Company | null;
  cpf: string | null;
  unidade: string | null;
  is_condutor: boolean;
  cod_vendedor: string | null;
  lider_direto_id: string | null;
  lider_direto?: LeaderProfile | null;
}

export function ExternalEmployeesList() {
  const enableManualEmployeeImport = import.meta.env.VITE_ENABLE_MANUAL_EMPLOYEE_IMPORT === "true";
  const useEmployeesApiAsPrimary = import.meta.env.VITE_EMPLOYEES_API_PRIMARY !== "false";
  const { selectedCompanyId, companies } = useCompany();
  const { role, hasAllCompaniesAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncingApi, setSyncingApi] = useState(false);
  const [employees, setEmployees] = useState<ExternalEmployee[]>([]);
  // ... (keep state variables same) ...
  const [filteredEmployees, setFilteredEmployees] = useState<ExternalEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [unidadeFilter, setUnidadeFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [relinkingAll, setRelinkingAll] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertibleCount, setConvertibleCount] = useState(0);
  const [convertingSingle, setConvertingSingle] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<ExternalEmployee | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<ExternalEmployee | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Verificar se o usuário pode ver todas as empresas
  const canViewAllCompanies = role === 'super_admin' || hasAllCompaniesAccess;

  useEffect(() => {
    fetchEmployees();
    if (canViewAllCompanies) {
      fetchConvertibleCount();
    }
  }, [selectedCompanyId, canViewAllCompanies]);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, departmentFilter, unidadeFilter, linkFilter, companyFilter]);

  const fetchEmployees = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('external_employees')
        .select(`
          *,
          profiles:linked_profile_id (
            id,
            first_name,
            last_name
          ),
          lider_direto:lider_direto_id (
            id,
            full_name
          ),
          companies:company_id (
            id,
            name
          )
        `)
        .eq('is_active', true) // Apenas funcionários ativos
        .order('full_name', { ascending: true });

      if (useEmployeesApiAsPrimary) {
        query = query.eq('source_system', 'dab_api');
      }

      // Se não for admin/CEO, filtrar por empresa selecionada
      if (!canViewAllCompanies && selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setEmployees(data || []);

      // Extract unique departments
      const uniqueDepts = [...new Set(data?.map(e => e.department).filter(Boolean) as string[])];
      setDepartments(uniqueDepts.sort());

      // Extract unique unidades
      const uniqueUnidades = [...new Set(data?.map(e => e.unidade).filter(Boolean) as string[])];
      setUnidades(uniqueUnidades.sort());

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

  const fetchConvertibleCount = async () => {
    try {
      let query = supabase
        .from('external_employees')
        .select('*', { count: 'exact', head: true })
        .not('email', 'is', null)
        .neq('email', '')
        .is('linked_profile_id', null)
        .eq('is_active', true);

      if (useEmployeesApiAsPrimary) {
        query = query.eq('source_system', 'dab_api');
      }

      const { count, error } = await query;

      if (!error) {
        setConvertibleCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching convertible count:', error);
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
        e.cpf?.toLowerCase().includes(term) ||
        e.cod_vendedor?.toLowerCase().includes(term) ||
        e.external_id.toLowerCase().includes(term)
      );
    }

    // Filtro de empresa (apenas para admins/CEOs)
    if (canViewAllCompanies && companyFilter !== "all") {
      filtered = filtered.filter(e => e.company_id === companyFilter);
    }

    if (departmentFilter !== "all") {
      filtered = filtered.filter(e => e.department === departmentFilter);
    }

    if (unidadeFilter !== "all") {
      filtered = filtered.filter(e => e.unidade === unidadeFilter);
    }

    if (linkFilter !== "all") {
      filtered = filtered.filter(e =>
        linkFilter === "linked" ? e.linked_profile_id !== null : e.linked_profile_id === null
      );
    }

    setFilteredEmployees(filtered);
  };

  const relinkAllEmployees = async () => {
    setRelinkingAll(true);
    try {
      const { data, error } = await supabase.rpc('link_all_external_employees');

      if (error) throw error;

      toast.success(`${data || 0} funcionário(s) vinculado(s) com sucesso`);
      fetchEmployees();
    } catch (error) {
      console.error('Error relinking employees:', error);
      toast.error('Erro ao vincular funcionários');
    } finally {
      setRelinkingAll(false);
    }
  };

  const handleConvertSingle = async (employee: ExternalEmployee) => {
    if (!employee.email) {
      toast.error('Funcionário não possui email cadastrado');
      return;
    }
    setConvertingSingle(employee.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-users-from-employees', {
        body: { employeeIds: [employee.id] },
      });

      if (error) throw error;

      if (data.success > 0) {
        toast.success(`${employee.full_name} foi habilitado como usuário!`);
        fetchEmployees();
        fetchConvertibleCount();
      } else if (data.skipped > 0) {
        toast.info(`${employee.full_name} já possui conta no sistema`);
      } else if (data.errors?.length > 0) {
        toast.error(`Erro: ${data.errors[0].error}`);
      }
    } catch (error) {
      console.error('Error converting single employee:', error);
      toast.error('Erro ao converter funcionário');
    } finally {
      setConvertingSingle(null);
    }
  };

  const handleEdit = (employee: ExternalEmployee) => {
    setEditingEmployee(employee);
    setEditDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEmployee) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("external_employees")
        .delete()
        .eq("id", deletingEmployee.id);

      if (error) throw error;

      toast.success(`${deletingEmployee.full_name} foi excluído`);
      fetchEmployees();
      if (canViewAllCompanies) fetchConvertibleCount();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error("Erro ao excluir funcionário");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingEmployee(null);
    }
  };

  const exportToCsv = () => {
    const headers = ['CPF', 'Matrícula', 'Nome', 'Email', 'Telefone', 'Departamento', 'Cargo', 'Unidade', 'Data Admissão', 'Cód. Vendedor', 'Líder Direto', 'Vinculado'];
    const rows = filteredEmployees.map(e => [
      e.cpf || '',
      e.registration_number || '',
      e.full_name,
      e.email || '',
      e.phone || '',
      e.department || '',
      e.position || '',
      e.unidade || '',
      e.hire_date ? format(new Date(e.hire_date), 'dd/MM/yyyy') : '',
      e.cod_vendedor || '',
      e.lider_direto?.full_name || '',
      e.linked_profile_id ? 'Sim' : 'Não'
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

  const maskCpf = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '');
    if (digits.length !== 11) return value || '-';
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
  };

  const handleApiSync = async () => {
    setSyncingApi(true);
    try {
      const result = await syncEmployeesFromDab();
      toast.success(`Sincronização concluída: ${result.totalFetched} lidos, ${result.inserted} novos, ${result.updated} atualizados, ${result.deactivated} inativados.`);
      await fetchEmployees();
      if (canViewAllCompanies) {
        await fetchConvertibleCount();
      }
    } catch (error: any) {
      const status = error?.context?.status ?? error?.status;
      const details = error?.details || error?.message;
      if (status === 401) {
        toast.error('Sessão inválida. Faça login novamente.');
      } else if (status === 403) {
        toast.error('Acesso negado ao endpoint configurado no proxy.');
      } else if (status === 404) {
        toast.error('Endpoint de funcionários não encontrado no backend.');
      } else if (status === 502 || status === 504) {
        toast.error('Backend temporariamente indisponível. Tente novamente em instantes.');
      } else {
        toast.error(details ? `Erro ao sincronizar funcionários via API: ${details}` : 'Erro ao sincronizar funcionários via API.');
      }
      console.error('[employees_api_sync_failed]', { status, message: error?.message, details });
    } finally {
      setSyncingApi(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            {canViewAllCompanies && (
              <>
                <Button
                  size="sm"
                  onClick={() => setConvertDialogOpen(true)}
                  disabled={convertibleCount === 0}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Usuários
                  {convertibleCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {convertibleCount}
                    </Badge>
                  )}
                </Button>
                {enableManualEmployeeImport && (
                  <ImportEmployeesDialog onComplete={() => { fetchEmployees(); fetchConvertibleCount(); }} />
                )}
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleApiSync} disabled={syncingApi}>
              {syncingApi ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar API
            </Button>
            <Button variant="outline" size="sm" onClick={relinkAllEmployees} disabled={relinkingAll}>
              {relinkingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Revincular
            </Button>
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

      {/* Convert to Users Dialog */}
      <ConvertToUsersDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        companyId={companyFilter !== "all" ? companyFilter : null}
        onSuccess={() => {
          fetchEmployees();
          fetchConvertibleCount();
        }}
      />
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, CPF, matrícula ou cód. vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* Filtro de empresa - apenas para admins/CEOs */}
          {canViewAllCompanies && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {unidades.map(unidade => (
                <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={linkFilter} onValueChange={setLinkFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Link2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="linked">Vinculados</SelectItem>
              <SelectItem value="unlinked">Não vinculados</SelectItem>
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
            <div className="text-2xl font-bold text-purple-600">
              {new Set(employees.map(e => e.company_id).filter(Boolean)).size}
            </div>
            <div className="text-xs text-muted-foreground">Empresas</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{unidades.length}</div>
            <div className="text-xs text-muted-foreground">Unidades</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{employees.filter(e => e.linked_profile_id).length}</div>
            <div className="text-xs text-muted-foreground">Vinculados</div>
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
                  {canViewAllCompanies && <TableHead>Empresa</TableHead>}
                  <TableHead>CPF</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Líder</TableHead>
                  <TableHead className="text-center">Vínculo</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    {canViewAllCompanies && (
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {employee.companies?.name || '-'}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm">
                      {maskCpf(employee.cpf || employee.registration_number)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{employee.full_name}</span>
                        {employee.cod_vendedor && (
                          <span className="text-xs text-muted-foreground">Cód: {employee.cod_vendedor}</span>
                        )}
                      </div>
                    </TableCell>
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
                    <TableCell>
                      {employee.unidade ? (
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="h-3 w-3" />
                          {employee.unidade}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {employee.lider_direto ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1">
                                <UserCircle className="h-3 w-3" />
                                {employee.lider_direto.full_name.split(' ')[0]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Líder: {employee.lider_direto.full_name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            {employee.linked_profile_id ? (
                              <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                <Link2 className="h-3 w-3" />
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <Link2Off className="h-3 w-3" />
                              </Badge>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            {employee.linked_profile_id && employee.profiles ? (
                              <p>Vinculado a: {employee.profiles.first_name} {employee.profiles.last_name}</p>
                            ) : (
                              <p>Não vinculado ao sistema</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Editar</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => { setDeletingEmployee(employee); setDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Excluir</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {canViewAllCompanies && !employee.linked_profile_id && employee.email && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleConvertSingle(employee)}
                                  disabled={convertingSingle === employee.id}
                                >
                                  {convertingSingle === employee.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserPlus className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Habilitar como usuário</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
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

      <EditEmployeeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        employee={editingEmployee}
        onSuccess={fetchEmployees}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingEmployee?.full_name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
