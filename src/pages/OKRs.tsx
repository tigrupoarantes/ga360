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
import { isPast, isToday } from "date-fns";
import { SmartPlanStats } from "@/components/smart-tasks/SmartPlanStats";
import { ActionPlanCard, type ActionPlanWithTasks } from "@/components/smart-tasks/ActionPlanCard";
import { ActionPlanFormDialog, type ActionPlanData } from "@/components/smart-tasks/ActionPlanFormDialog";
import { TaskFormDialog, type TaskData } from "@/components/smart-tasks/TaskFormDialog";
import { TaskTimelinePanel } from "@/components/smart-tasks/TaskTimelinePanel";

type ResolvedPlanStatus = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado" | "cancelado";

function resolvePlanStatus(plan: { status: string; end_date: string }): ResolvedPlanStatus {
  if (plan.status === "completed") return "concluido";
  if (plan.status === "cancelled") return "cancelado";
  const endDate = new Date(plan.end_date);
  if (isPast(endDate) && !isToday(endDate)) return "atrasado";
  if (plan.status === "active") return "em_andamento";
  return "nao_iniciado";
}

export default function OKRs() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Plan form
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlanData | null>(null);

  // Task form
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);
  const [taskActionPlanId, setTaskActionPlanId] = useState("");
  const [taskObjectiveId, setTaskObjectiveId] = useState("");

  // Timeline
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelinePlan, setTimelinePlan] = useState<ActionPlanWithTasks | null>(null);

  // Query: plans with action_plans (sem nested 3 níveis — PostgREST não suporta)
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["smart-plans", selectedCompany?.id],
    queryFn: async () => {
      // Query 1: objectives + action_plans
      const { data: objectives, error: objError } = await supabase
        .from("okr_objectives")
        .select(`
          id, title, description, start_date, end_date, status, progress, owner_id,
          okr_action_plans (id)
        `)
        .eq("company_id", selectedCompany?.id)
        .order("created_at", { ascending: false });
      if (objError) throw objError;
      if (!objectives?.length) return [];

      // Collect all action_plan IDs
      const planIds = objectives
        .flatMap((o: any) => (o.okr_action_plans ?? []).map((p: any) => p.id))
        .filter(Boolean);

      // Collect all employee IDs (owners + future assignees)
      const ownerIds = objectives.map((o: any) => o.owner_id).filter(Boolean);

      // Query 2: tasks for all action_plans
      let tasksMap: Record<string, TaskData[]> = {};
      let allTaskAssigneeIds: string[] = [];
      if (planIds.length > 0) {
        const { data: tasks, error: taskError } = await supabase
          .from("okr_action_tasks")
          .select("id, title, assignee_id, start_date, end_date, status, action_plan_id")
          .in("action_plan_id", planIds);
        if (taskError) throw taskError;

        allTaskAssigneeIds = (tasks ?? []).map((t) => t.assignee_id).filter(Boolean);

        // Will populate assignee_name after employee fetch
        for (const t of tasks ?? []) {
          const key = t.action_plan_id;
          if (!tasksMap[key]) tasksMap[key] = [];
          tasksMap[key].push({
            id: t.id,
            title: t.title,
            assignee_id: t.assignee_id,
            start_date: t.start_date,
            end_date: t.end_date,
            status: t.status,
            assignee_name: null,
          });
        }
      }

      // Query 3: fetch all employee names at once
      const allEmployeeIds = [...new Set([...ownerIds, ...allTaskAssigneeIds])];
      let employeeMap: Record<string, string> = {};
      if (allEmployeeIds.length > 0) {
        const { data: employees } = await supabase
          .from("external_employees")
          .select("id, full_name")
          .in("id", allEmployeeIds);
        for (const e of employees ?? []) {
          employeeMap[e.id] = e.full_name;
        }
      }

      // Fill assignee names in tasks
      for (const tasks of Object.values(tasksMap)) {
        for (const t of tasks) {
          t.assignee_name = employeeMap[t.assignee_id] ?? null;
        }
      }

      // Merge
      return objectives.map((obj: any): ActionPlanWithTasks => {
        const firstPlan = obj.okr_action_plans?.[0];
        const tasks = firstPlan ? (tasksMap[firstPlan.id] ?? []) : [];

        return {
          id: obj.id,
          title: obj.title,
          description: obj.description,
          start_date: obj.start_date,
          end_date: obj.end_date,
          status: obj.status,
          progress: obj.progress,
          owner_id: obj.owner_id ?? null,
          owner_name: employeeMap[obj.owner_id] ?? null,
          defaultPlanId: firstPlan?.id ?? "",
          tasks,
        };
      });
    },
    enabled: !!selectedCompany?.id,
  });

  // Delete plan
  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("okr_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-plans"] });
      toast.success("Plano excluído");
    },
    onError: () => toast.error("Erro ao excluir plano"),
  });

  // Delete task
  const deleteTask = useMutation({
    mutationFn: async ({ taskId, actionPlanId, objectiveId }: { taskId: string; actionPlanId: string; objectiveId: string }) => {
      const { error } = await supabase.from("okr_action_tasks").delete().eq("id", taskId);
      if (error) throw error;

      // Recalculate progress
      const { data: remaining } = await supabase
        .from("okr_action_tasks")
        .select("status")
        .eq("action_plan_id", actionPlanId);

      const total = remaining?.length ?? 0;
      const done = remaining?.filter((t) => t.status === "concluido").length ?? 0;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;

      await supabase.from("okr_objectives").update({ progress }).eq("id", objectiveId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-plans"] });
      toast.success("Tarefa excluída");
    },
    onError: () => toast.error("Erro ao excluir tarefa"),
  });

  // Filter plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const resolved = resolvePlanStatus(p);
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || resolved === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [plans, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const counts = { total: plans.length, naoIniciado: 0, emAndamento: 0, concluido: 0, atrasado: 0, cancelado: 0 };
    for (const p of plans) {
      const s = resolvePlanStatus(p);
      if (s === "nao_iniciado") counts.naoIniciado++;
      else if (s === "em_andamento") counts.emAndamento++;
      else if (s === "concluido") counts.concluido++;
      else if (s === "atrasado") counts.atrasado++;
      else if (s === "cancelado") counts.cancelado++;
    }
    return counts;
  }, [plans]);

  // Handlers
  const handleEditPlan = (plan: ActionPlanWithTasks) => {
    setEditingPlan({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      start_date: plan.start_date,
      end_date: plan.end_date,
      status: plan.status,
      progress: plan.progress,
      owner_id: plan.owner_id,
      owner_name: plan.owner_name,
      defaultPlanId: plan.defaultPlanId,
    });
    setPlanFormOpen(true);
  };

  const handleDeletePlan = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este plano e todas as suas tarefas?")) {
      deletePlan.mutate(id);
    }
  };

  const handleAddTask = (plan: ActionPlanWithTasks) => {
    setEditingTask(null);
    setTaskActionPlanId(plan.defaultPlanId);
    setTaskObjectiveId(plan.id);
    setTaskFormOpen(true);
  };

  const handleEditTask = (task: TaskData, plan: ActionPlanWithTasks) => {
    setEditingTask(task);
    setTaskActionPlanId(plan.defaultPlanId);
    setTaskObjectiveId(plan.id);
    setTaskFormOpen(true);
  };

  const handleDeleteTask = (taskId: string, plan: ActionPlanWithTasks) => {
    deleteTask.mutate({
      taskId,
      actionPlanId: plan.defaultPlanId,
      objectiveId: plan.id,
    });
  };

  const handleOpenTimeline = (plan: ActionPlanWithTasks) => {
    setTimelinePlan(plan);
    setTimelineOpen(true);
  };

  const closePlanForm = (open: boolean) => {
    if (!open) {
      setPlanFormOpen(false);
      setEditingPlan(null);
    }
  };

  const closeTaskForm = (open: boolean) => {
    if (!open) {
      setTaskFormOpen(false);
      setEditingTask(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Planos de Ação SMART</h1>
            <p className="text-muted-foreground">
              Específicas · Mensuráveis · Atingíveis · Relevantes · Temporais
              {selectedCompany ? ` — ${selectedCompany.name}` : ""}
            </p>
          </div>
          <Button onClick={() => setPlanFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </div>

        {!selectedCompany && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Selecione uma empresa no menu superior para visualizar os planos.
            </AlertDescription>
          </Alert>
        )}

        {selectedCompany && (
          <>
            <SmartPlanStats {...stats} />

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar planos de ação..."
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

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum plano de ação encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPlans.map((plan) => (
                  <ActionPlanCard
                    key={plan.id}
                    plan={plan}
                    onEditPlan={() => handleEditPlan(plan)}
                    onDeletePlan={() => handleDeletePlan(plan.id)}
                    onAddTask={() => handleAddTask(plan)}
                    onEditTask={(task) => handleEditTask(task, plan)}
                    onDeleteTask={(taskId) => handleDeleteTask(taskId, plan)}
                    onOpenTimeline={() => handleOpenTimeline(plan)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Dialogs */}
        <ActionPlanFormDialog
          open={planFormOpen}
          onOpenChange={closePlanForm}
          plan={editingPlan}
        />

        {taskActionPlanId && (
          <TaskFormDialog
            open={taskFormOpen}
            onOpenChange={closeTaskForm}
            actionPlanId={taskActionPlanId}
            objectiveId={taskObjectiveId}
            task={editingTask}
          />
        )}

        {timelinePlan && (
          <TaskTimelinePanel
            open={timelineOpen}
            onOpenChange={setTimelineOpen}
            planTitle={timelinePlan.title}
            tasks={timelinePlan.tasks}
          />
        )}
      </div>
    </MainLayout>
  );
}
