import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Play, ClipboardList, Users, Calendar, AlertTriangle } from "lucide-react";
import { ProcessFormDialog } from "./ProcessFormDialog";
import { ProcessExecutionDialog } from "./ProcessExecutionDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getNextExecutionDate, isProcessOverdue, frequencyLabels } from "@/lib/processUtils";

interface Process {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  is_active: boolean;
  area_id: string | null;
  created_at: string;
  areas?: { name: string } | null;
  process_checklist_items?: { id: string }[];
  process_responsibles?: { user_id: string }[];
  process_executions?: { completed_at: string | null; status: string }[];
}

export function ProcessList() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [executingProcess, setExecutingProcess] = useState<Process | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");

  const fetchProcesses = async () => {
    if (!selectedCompanyId) {
      setProcesses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let query = supabase
      .from("processes")
      .select(`
        *,
        areas(name),
        process_checklist_items(id),
        process_responsibles(user_id),
        process_executions(completed_at, status)
      `)
      .eq("company_id", selectedCompanyId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("is_active", statusFilter === "active");
    }

    if (frequencyFilter !== "all") {
      query = query.eq("frequency", frequencyFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching processes:", error);
    }
    if (data) setProcesses(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProcesses();
  }, [selectedCompanyId, statusFilter, frequencyFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("processes").delete().eq("id", deleteId);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Processo excluído com sucesso" });
      fetchProcesses();
    }
    setDeleteId(null);
  };

  const handleEdit = (process: Process) => {
    setEditingProcess(process);
    setFormOpen(true);
  };

  const handleExecute = (process: Process) => {
    setExecutingProcess(process);
    setExecutionOpen(true);
  };

  const getLastExecution = (process: Process): Date | null => {
    const completedExecutions = process.process_executions?.filter(e => e.status === 'completed' && e.completed_at);
    if (!completedExecutions || completedExecutions.length === 0) return null;
    const sorted = completedExecutions.sort((a, b) => 
      new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
    );
    return new Date(sorted[0].completed_at!);
  };

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para gerenciar os processos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="daily">Diária</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="biweekly">Quinzenal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditingProcess(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Processo
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-6">
                <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : processes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum processo encontrado</p>
            <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro processo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processes.map(process => {
            const lastExecution = getLastExecution(process);
            const nextExecution = getNextExecutionDate(process.frequency, lastExecution);
            const isOverdue = isProcessOverdue(nextExecution);
            const checklistCount = process.process_checklist_items?.length || 0;
            const responsibleCount = process.process_responsibles?.length || 0;

            return (
              <Card key={process.id} className={`relative ${!process.is_active ? 'opacity-60' : ''}`}>
                {isOverdue && process.is_active && (
                  <div className="absolute -top-2 -right-2">
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Atrasado
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{process.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline">{frequencyLabels[process.frequency]}</Badge>
                        {process.areas && (
                          <Badge variant="secondary">{process.areas.name}</Badge>
                        )}
                        {!process.is_active && (
                          <Badge variant="destructive">Inativo</Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {process.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {process.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ClipboardList className="h-4 w-4" />
                      {checklistCount} itens
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {responsibleCount} resp.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                      Próxima: {nextExecution.toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    {process.is_active && (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleExecute(process)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Executar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(process)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(process.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProcessFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        process={editingProcess}
        onSuccess={fetchProcesses}
      />

      <ProcessExecutionDialog
        open={executionOpen}
        onOpenChange={setExecutionOpen}
        process={executingProcess}
        onSuccess={fetchProcesses}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Processo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todo o histórico de execuções também será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
