import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Mail, Building2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { toast } from "sonner";

interface ExternalEmployee {
  id: string;
  email: string;
  full_name: string;
  company_id: string | null;
  company?: { name: string } | null;
}

interface ConvertToUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string | null;
  onSuccess?: () => void;
}

interface ConversionResult {
  success: number;
  skipped: number;
  errors: { email: string; error: string }[];
  created: { email: string; name: string }[];
}

export function ConvertToUsersDialog({ 
  open, 
  onOpenChange, 
  companyId,
  onSuccess 
}: ConvertToUsersDialogProps) {
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [employees, setEmployees] = useState<ExternalEmployee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ConversionResult | null>(null);

  useEffect(() => {
    if (open) {
      fetchEligibleEmployees();
      setResult(null);
    }
  }, [open, companyId]);

  const fetchEligibleEmployees = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("external_employees")
        .select("id, email, full_name, company_id, company:companies(name)")
        .not("email", "is", null)
        .neq("email", "")
        .is("linked_profile_id", null)
        .eq("is_active", true)
        .order("full_name");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const employeeData = (data || []).map(emp => ({
        ...emp,
        company: Array.isArray(emp.company) ? emp.company[0] : emp.company
      })) as ExternalEmployee[];

      setEmployees(employeeData);
      setSelectedIds(new Set(employeeData.map(e => e.id)));
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Erro ao carregar funcionários elegíveis");
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
  };

  const handleConvert = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um funcionário");
      return;
    }

    setConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-users-from-employees", {
        body: { employeeIds: Array.from(selectedIds) },
      });

      if (error) throw error;

      setResult(data as ConversionResult);

      if (data.success > 0) {
        toast.success(`${data.success} usuário(s) criado(s) com sucesso!`);
        onSuccess?.();
      }

      if (data.skipped > 0) {
        toast.info(`${data.skipped} usuário(s) já existiam e foram ignorados`);
      }

      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} erro(s) durante a conversão`);
      }

    } catch (error) {
      console.error("Error converting employees:", error);
      toast.error("Erro ao converter funcionários");
    } finally {
      setConverting(false);
    }
  };

  const handleClose = () => {
    if (!converting) {
      onOpenChange(false);
      setResult(null);
      setSelectedIds(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Converter Funcionários em Usuários
          </DialogTitle>
          <DialogDescription>
            Selecione os funcionários que serão convertidos em usuários do sistema. 
            Cada um receberá um email para definir sua senha.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{result.success}</p>
                  <p className="text-sm text-muted-foreground">Criados</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-4 bg-yellow-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{result.skipped}</p>
                  <p className="text-sm text-muted-foreground">Ignorados</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-4 bg-red-500/10 rounded-lg">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{result.errors.length}</p>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
              </div>
            </div>

            {result.created.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Usuários criados:</p>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {result.created.map((user, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>{user.name}</span>
                      <span className="text-muted-foreground">({user.email})</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm text-red-500">Erros:</p>
                <ScrollArea className="h-32 border border-red-200 rounded-md p-2">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 text-sm">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{err.email}</span>
                      <span className="text-muted-foreground">- {err.error}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum funcionário elegível</p>
            <p className="text-sm text-muted-foreground">
              Todos os funcionários com email já foram convertidos ou não possuem email cadastrado.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedIds.size === employees.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">
                  Selecionar todos ({employees.length})
                </span>
              </div>
              <Badge variant="secondary">
                {selectedIds.size} selecionado(s)
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[300px] pr-4">
              <div className="space-y-2">
                {employees.map((employee) => (
                  <div 
                    key={employee.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => toggleEmployee(employee.id)}
                  >
                    <Checkbox 
                      checked={selectedIds.has(employee.id)}
                      onCheckedChange={() => toggleEmployee(employee.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{employee.full_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    </div>
                    {employee.company?.name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>{employee.company.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={converting}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConvert} 
                disabled={converting || selectedIds.size === 0 || loading}
              >
                {converting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Converter {selectedIds.size} Funcionário(s)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
