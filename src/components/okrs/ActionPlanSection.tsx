import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ListTodo,
  Edit,
  Trash2,
  User,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ActionPlanFormDialog } from "./ActionPlanFormDialog";
import { ActionTaskFormDialog } from "./ActionTaskFormDialog";
import { toast } from "sonner";

interface ActionPlanSectionProps {
  objectiveId: string;
}

type TaskStatus = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado" | "cancelado";

interface TaskAssignee {
  first_name: string | null;
  last_name: string | null;
}

interface ActionTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  start_date: string;
  end_date: string;
  assignee_id: string;
  assignee: TaskAssignee | null;
}

interface ActionPlan {
  id: string;
  title: string;
  description: string | null;
  created_at: string | null;
  okr_action_tasks: ActionTask[] | null;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  nao_iniciado:  { label: "Não Iniciado",  className: "bg-muted text-muted-foreground" },
  em_andamento:  { label: "Em Andamento",  className: "bg-primary/20 text-primary" },
  concluido:     { label: "Concluído",     className: "bg-green-500/20 text-green-500" },
  atrasado:      { label: "Atrasado",      className: "bg-destructive/20 text-destructive" },
  cancelado:     { label: "Cancelado",     className: "bg-muted text-muted-foreground line-through" },
};

function isTaskLate(task: ActionTask): boolean {
  if (task.status === "concluido" || task.status === "cancelado") return false;
  const end = new Date(task.end_date);
  return isPast(end) && !isToday(end);
}

export function ActionPlanSection({ objectiveId }: ActionPlanSectionProps) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  // Dialog state
  const [actionPlanDialogOpen, setActionPlanDialogOpen] = useState(false);
  const [editingActionPlan, setEditingActionPlan] = useState<ActionPlan | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogActionId, setTaskDialogActionId] = useState<string>("");
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  const { data: actionPlans = [], isLoading } = useQuery<ActionPlan[]>({
    queryKey: ["okr-action-plans", objectiveId, selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("okr_action_plans")
        .select(`
          id, title, description, created_at,
          okr_action_tasks (
            id, title, description, status,
            start_date, end_date,
            assignee_id,
            assignee:profiles!okr_action_tasks_assignee_id_fkey (first_name, last_name)
          )
        `)
        .eq("objective_id", objectiveId)
        .eq("company_id", selectedCompany?.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isOpen && !!selectedCompany?.id,
  });

  const deleteActionPlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("okr_action_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okr-action-plans", objectiveId, selectedCompany?.id] });
      toast.success("Ação excluída");
    },
    onError: () => toast.error("Erro ao excluir ação"),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("okr_action_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okr-action-plans", objectiveId, selectedCompany?.id] });
      toast.success("Tarefa excluída");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  const totalTasks = actionPlans.reduce(
    (acc, ap) => acc + (ap.okr_action_tasks?.length ?? 0),
    0
  );

  const togglePlan = (id: string) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNewTask = (actionPlanId: string) => {
    setEditingTask(null);
    setTaskDialogActionId(actionPlanId);
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: ActionTask, actionPlanId: string) => {
    setEditingTask(task);
    setTaskDialogActionId(actionPlanId);
    setTaskDialogOpen(true);
  };

  const openEditActionPlan = (ap: ActionPlan) => {
    setEditingActionPlan(ap);
    setActionPlanDialogOpen(true);
  };

  const openNewActionPlan = () => {
    setEditingActionPlan(null);
    setActionPlanDialogOpen(true);
  };

  return (
    <>
      {/* Toggle button — mesmo padrão do Key Results */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ListTodo className="h-4 w-4 mr-2" />
        {totalTasks > 0
          ? `${actionPlans.length} Ação(ões) · ${totalTasks} Tarefa(s)`
          : `${actionPlans.length} Ação(ões) SMART`}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 ml-auto" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-auto" />
        )}
      </Button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-2">Carregando...</p>
          ) : actionPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhuma ação definida
            </p>
          ) : (
            actionPlans.map((ap) => {
              const tasks: ActionTask[] = ap.okr_action_tasks ?? [];
              const expanded = expandedPlans.has(ap.id);
              const doneTasks = tasks.filter((t) => t.status === "concluido").length;

              return (
                <div
                  key={ap.id}
                  className="rounded-lg border border-border/50 bg-background/50"
                >
                  {/* Cabeçalho da Ação */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-background/80 rounded-t-lg"
                    onClick={() => togglePlan(ap.id)}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium flex-1 truncate">{ap.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {doneTasks}/{tasks.length}
                    </span>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEditActionPlan(ap)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Excluir esta ação e todas as suas tarefas?")) {
                            deleteActionPlan.mutate(ap.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Tarefas da Ação */}
                  {expanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                      {ap.description && (
                        <p className="text-xs text-muted-foreground italic mb-2">
                          {ap.description}
                        </p>
                      )}

                      {tasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          Nenhuma tarefa ainda
                        </p>
                      ) : (
                        tasks.map((task) => {
                          const late = isTaskLate(task);
                          const cfg = statusConfig[task.status] ?? statusConfig.nao_iniciado;

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-start gap-2 p-2 rounded-md border",
                                late
                                  ? "border-destructive/40 bg-destructive/5"
                                  : "border-border/40 bg-background/30"
                              )}
                            >
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-sm font-medium truncate">{task.title}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {task.assignee && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {task.assignee.first_name} {task.assignee.last_name}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <CalendarRange className="h-3 w-3" />
                                    {format(new Date(task.start_date), "dd/MM", { locale: ptBR })}
                                    {" → "}
                                    {format(new Date(task.end_date), "dd/MM/yy", { locale: ptBR })}
                                    {late && (
                                      <span className="text-destructive font-medium ml-1">
                                        (atrasado)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge className={cn("text-xs", cfg.className)}>
                                  {cfg.label}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => openEditTask(task, ap.id)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm("Excluir esta tarefa?")) {
                                      deleteTask.mutate(task.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7 mt-1"
                        onClick={() => openNewTask(ap.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Nova Tarefa
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Botão Nova Ação */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={openNewActionPlan}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Ação
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <ActionPlanFormDialog
        open={actionPlanDialogOpen}
        onOpenChange={(v) => {
          setActionPlanDialogOpen(v);
          if (!v) setEditingActionPlan(null);
        }}
        objectiveId={objectiveId}
        actionPlan={editingActionPlan}
      />

      <ActionTaskFormDialog
        open={taskDialogOpen}
        onOpenChange={(v) => {
          setTaskDialogOpen(v);
          if (!v) setEditingTask(null);
        }}
        actionPlanId={taskDialogActionId}
        objectiveId={objectiveId}
        task={editingTask}
      />
    </>
  );
}
