import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCompany } from "@/contexts/CompanyContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { SmartTaskStats } from "@/components/smart-tasks/SmartTaskStats";
import { SmartTaskFormDialog, type SmartTask } from "@/components/smart-tasks/SmartTaskFormDialog";
import { SmartTaskTable, resolveStatus } from "@/components/smart-tasks/SmartTaskTable";

export default function OKRs() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SmartTask | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["smart-tasks", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("okr_objectives")
        .select(`
          id, title, description, owner_id, start_date, end_date, status,
          owner:profiles!okr_objectives_owner_id_fkey (first_name, last_name)
        `)
        .eq("company_id", selectedCompany?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SmartTask[];
    },
    enabled: !!selectedCompany?.id,
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("okr_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-tasks"] });
      toast.success("Tarefa excluída");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const resolved = resolveStatus(t);
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || resolved === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, statusFilter]);

  const stats = useMemo(() => {
    const counts = { total: tasks.length, naoIniciado: 0, emAndamento: 0, concluido: 0, atrasado: 0, cancelado: 0 };
    for (const t of tasks) {
      const s = resolveStatus(t);
      if (s === "nao_iniciado") counts.naoIniciado++;
      else if (s === "em_andamento") counts.emAndamento++;
      else if (s === "concluido") counts.concluido++;
      else if (s === "atrasado") counts.atrasado++;
      else if (s === "cancelado") counts.cancelado++;
    }
    return counts;
  }, [tasks]);

  const handleEdit = (task: SmartTask) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleCloseForm = (open: boolean) => {
    if (!open) {
      setIsFormOpen(false);
      setEditingTask(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tarefas SMART</h1>
            <p className="text-muted-foreground">
              Específicas · Mensuráveis · Atingíveis · Relevantes · Temporais
              {selectedCompany ? ` — ${selectedCompany.name}` : ""}
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>

        {!selectedCompany && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Selecione uma empresa no menu superior para visualizar as tarefas.
            </AlertDescription>
          </Alert>
        )}

        {selectedCompany && (
          <>
            <SmartTaskStats {...stats} />

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou nome da tarefa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="nao_iniciado">Não Iniciado</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SmartTaskTable
              tasks={filteredTasks}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          </>
        )}

        <SmartTaskFormDialog
          open={isFormOpen}
          onOpenChange={handleCloseForm}
          task={editingTask}
        />
      </div>
    </MainLayout>
  );
}
