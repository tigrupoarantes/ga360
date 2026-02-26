import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Bot,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { GoalAgentPanel } from "@/components/metas/GoalAgentPanel";

interface Goal {
  id: string;
  company_id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  type: "numeric" | "activity" | "hybrid";
  pillar: "FAT" | "RT" | "MS" | "SC" | "DN" | "CO" | "ESG" | null;
  unit: string | null;
  target_value: number | null;
  current_value: number;
  start_date: string | null;
  end_date: string | null;
  cadence: "monthly" | "activity" | "quarterly" | "annual";
  status: "active" | "completed" | "paused" | "cancelled";
  created_at: string;
}

interface GoalActivity {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  weight: number;
  due_date: string | null;
  created_at: string;
}

interface GoalUpdate {
  id: string;
  goal_id: string;
  value: number;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
}

interface AreaOption {
  id: string;
  name: string;
}

type DynamicQueryResult<T> = Promise<{ data: T | null; error: { message?: string } | null }>;

interface DynamicTableQuery<T> {
  select: (columns: string) => DynamicTableQuery<T>;
  insert: (values: unknown) => DynamicTableQuery<T>;
  update: (values: unknown) => DynamicTableQuery<T>;
  delete: () => DynamicTableQuery<T>;
  eq: (column: string, value: unknown) => DynamicTableQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => DynamicTableQuery<T>;
  limit: (count: number) => DynamicTableQuery<T>;
  single: () => DynamicQueryResult<T>;
  then: PromiseLike<{ data: T | null; error: { message?: string } | null }>["then"];
}

interface DynamicSupabaseClient {
  from: <T = unknown>(table: string) => DynamicTableQuery<T>;
}

type GoalFormData = {
  title: string;
  description: string;
  type: Goal["type"];
  pillar: NonNullable<Goal["pillar"]> | "none";
  unit: string;
  target_value: string;
  current_value: string;
  start_date: string;
  end_date: string;
  cadence: Goal["cadence"];
  status: Goal["status"];
  area_id: string;
};

const defaultGoalFormData: GoalFormData = {
  title: "",
  description: "",
  type: "numeric",
  pillar: "none",
  unit: "",
  target_value: "",
  current_value: "0",
  start_date: "",
  end_date: "",
  cadence: "monthly",
  status: "active",
  area_id: "none",
};

const statusLabel: Record<Goal["status"], string> = {
  active: "Ativa",
  completed: "Concluída",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const typeLabel: Record<Goal["type"], string> = {
  numeric: "Numérica",
  activity: "Atividade",
  hybrid: "Híbrida",
};

const activityStatusLabel: Record<GoalActivity["status"], string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
};

export default function Metas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { checkPermission } = useAuth();
  const { selectedCompanyId } = useCompany();
  const db = supabase as unknown as DynamicSupabaseClient;

  const canCreate = checkPermission("metas", "create");
  const canEdit = checkPermission("metas", "edit");
  const canDelete = checkPermission("metas", "delete");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormData, setGoalFormData] = useState<GoalFormData>(defaultGoalFormData);

  const [progressValue, setProgressValue] = useState("0");

  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityWeight, setActivityWeight] = useState("1");
  const [activityDueDate, setActivityDueDate] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);

  const goalsKey = ["metas", "goals", selectedCompanyId] as const;
  const areasKey = ["metas", "areas", selectedCompanyId] as const;
  const activitiesKey = ["metas", "activities", selectedGoalId] as const;
  const updatesKey = ["metas", "updates", selectedGoalId] as const;

  const areasQuery = useQuery({
    queryKey: areasKey,
    queryFn: async () => {
      let query = db
        .from("areas")
        .select("id, name")
        .order("name", { ascending: true });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AreaOption[];
    },
  });

  const goalsQuery = useQuery({
    queryKey: goalsKey,
    queryFn: async () => {
      let query = db
        .from<Goal[]>("goals")
        .select(
          "id, company_id, area_id, title, description, type, pillar, unit, target_value, current_value, start_date, end_date, cadence, status, created_at"
        )
        .order("created_at", { ascending: false });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Goal[];
    },
  });

  const selectedGoal = useMemo(
    () => (goalsQuery.data || []).find((goal) => goal.id === selectedGoalId) || null,
    [goalsQuery.data, selectedGoalId]
  );

  const areaNameMap = useMemo(
    () => new Map((areasQuery.data || []).map((area) => [area.id, area.name])),
    [areasQuery.data]
  );

  const filteredGoals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return (goalsQuery.data || []).filter((goal) => {
      const statusMatch = statusFilter === "all" || goal.status === statusFilter;
      const searchMatch =
        term.length === 0 ||
        goal.title.toLowerCase().includes(term) ||
        (goal.description ?? "").toLowerCase().includes(term);

      return statusMatch && searchMatch;
    });
  }, [goalsQuery.data, searchTerm, statusFilter]);

  const activitiesQuery = useQuery({
    queryKey: activitiesKey,
    enabled: !!selectedGoalId,
    queryFn: async () => {
      const { data, error } = await db
        .from<GoalActivity[]>("goal_activities")
        .select("id, goal_id, title, description, status, weight, due_date, created_at")
        .eq("goal_id", selectedGoalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GoalActivity[];
    },
  });

  const updatesQuery = useQuery({
    queryKey: updatesKey,
    enabled: !!selectedGoalId,
    queryFn: async () => {
      const { data, error } = await db
        .from<GoalUpdate[]>("goal_updates")
        .select("id, goal_id, value, notes, updated_by, created_at")
        .eq("goal_id", selectedGoalId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []) as GoalUpdate[];
    },
  });

  useEffect(() => {
    if (!filteredGoals.length) {
      setSelectedGoalId(null);
      return;
    }

    const goalStillVisible = filteredGoals.some((goal) => goal.id === selectedGoalId);
    if (!goalStillVisible) {
      setSelectedGoalId(filteredGoals[0].id);
    }
  }, [filteredGoals, selectedGoalId]);

  useEffect(() => {
    if (selectedGoal) {
      setProgressValue(String(selectedGoal.current_value));
    }
  }, [selectedGoal]);

  const closeGoalDialog = () => {
    setGoalDialogOpen(false);
    setEditingGoal(null);
    setGoalFormData(defaultGoalFormData);
  };

  const openCreateGoalDialog = () => {
    setEditingGoal(null);
    setGoalFormData(defaultGoalFormData);
    setGoalDialogOpen(true);
  };

  const openEditGoalDialog = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalFormData({
      title: goal.title,
      description: goal.description ?? "",
      type: goal.type,
      pillar: goal.pillar ?? "none",
      unit: goal.unit ?? "",
      target_value: goal.target_value?.toString() ?? "",
      current_value: String(goal.current_value),
      start_date: goal.start_date ?? "",
      end_date: goal.end_date ?? "",
      cadence: goal.cadence,
      status: goal.status,
      area_id: goal.area_id ?? "none",
    });
    setGoalDialogOpen(true);
  };

  const saveGoalMutation = useMutation({
    mutationFn: async () => {
      if (!goalFormData.title.trim()) {
        throw new Error("Informe o título da meta");
      }

      if (!editingGoal && !selectedCompanyId) {
        throw new Error("Selecione uma empresa para criar a meta");
      }

      const payload = {
        title: goalFormData.title.trim(),
        description: goalFormData.description.trim() || null,
        type: goalFormData.type,
        pillar: goalFormData.pillar === "none" ? null : goalFormData.pillar,
        unit: goalFormData.unit.trim() || null,
        target_value: goalFormData.target_value === "" ? null : Number(goalFormData.target_value),
        current_value: Number(goalFormData.current_value || 0),
        start_date: goalFormData.start_date || null,
        end_date: goalFormData.end_date || null,
        cadence: goalFormData.cadence,
        status: goalFormData.status,
        area_id: goalFormData.area_id === "none" ? null : goalFormData.area_id,
      };

      if (editingGoal) {
        const { error } = await db
          .from("goals")
          .update(payload)
          .eq("id", editingGoal.id);

        if (error) throw error;
        return "updated";
      }

      const { data, error } = await db
        .from<{ id: string }>("goals")
        .insert({
          ...payload,
          company_id: selectedCompanyId,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      closeGoalDialog();
      toast({ title: editingGoal ? "Meta atualizada com sucesso" : "Meta criada com sucesso" });

      if (typeof result === "string" && result !== "updated") {
        setSelectedGoalId(result);
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar meta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goal: Goal) => {
      const { error } = await db.from("goals").delete().eq("id", goal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      queryClient.invalidateQueries({ queryKey: updatesKey });
      toast({ title: "Meta excluída" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir meta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGoalId) throw new Error("Selecione uma meta");

      const numericValue = Number(progressValue);
      if (Number.isNaN(numericValue) || numericValue < 0) {
        throw new Error("Informe um valor de progresso válido");
      }

      const { error } = await db
        .from("goals")
        .update({ current_value: numericValue })
        .eq("id", selectedGoalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKey });
      queryClient.invalidateQueries({ queryKey: updatesKey });
      toast({ title: "Progresso atualizado" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar progresso",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGoalId) throw new Error("Selecione uma meta");
      if (!activityTitle.trim()) throw new Error("Informe o título da atividade");

      const payload = {
        goal_id: selectedGoalId,
        title: activityTitle.trim(),
        description: activityDescription.trim() || null,
        weight: Number(activityWeight || 1),
        due_date: activityDueDate || null,
      };

      if (payload.weight <= 0 || Number.isNaN(payload.weight)) {
        throw new Error("Peso da atividade deve ser maior que zero");
      }

      const { error } = await db.from("goal_activities").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      setActivityTitle("");
      setActivityDescription("");
      setActivityWeight("1");
      setActivityDueDate("");
      toast({ title: "Atividade adicionada" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({
      activityId,
      status,
    }: {
      activityId: string;
      status: GoalActivity["status"];
    }) => {
      const { error } = await db
        .from("goal_activities")
        .update({ status })
        .eq("id", activityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({ title: "Atividade atualizada" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await db
        .from("goal_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({ title: "Atividade removida" });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const handleDeleteGoal = (goal: Goal) => {
    if (!canDelete) return;

    const confirmed = window.confirm(`Deseja excluir a meta "${goal.title}"?`);
    if (!confirmed) return;

    deleteGoalMutation.mutate(goal);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Metas</h1>
            <p className="text-muted-foreground mt-1">Gestão operacional do portal de metas (Fase 2)</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setAgentOpen(true)}
              title="Abrir assistente de IA"
            >
              <Bot className="h-4 w-4" />
            </Button>

            {canCreate && (
              <Button onClick={openCreateGoalDialog} className="gap-2" disabled={!selectedCompanyId}>
                <Plus className="h-4 w-4" />
                Nova Meta
              </Button>
            )}
          </div>
        </div>

        {!selectedCompanyId && (
          <Card className="p-4 text-sm text-muted-foreground">
            Selecione uma empresa no topo para criar metas. A listagem abaixo mostra metas das empresas às
            quais você tem acesso.
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <Card className="p-4 animate-fade-in-up">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[240px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar metas..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {goalsQuery.isLoading ? (
              <Card className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando metas...
              </Card>
            ) : goalsQuery.error ? (
              <Card className="p-8 text-center text-destructive">
                Erro ao carregar metas. Tente novamente.
              </Card>
            ) : filteredGoals.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhuma meta encontrada.</Card>
            ) : (
              <div className="grid gap-4 animate-fade-in-up">
                {filteredGoals.map((goal) => {
                  const isSelected = goal.id === selectedGoalId;

                  return (
                    <Card
                      key={goal.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected ? "border-primary/60" : "hover:border-primary/30"
                      }`}
                      onClick={() => setSelectedGoalId(goal.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold text-foreground">{goal.title}</h3>
                          </div>

                          {goal.description && (
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="secondary">{statusLabel[goal.status]}</Badge>
                            <Badge variant="outline">{typeLabel[goal.type]}</Badge>
                            {goal.area_id && areaNameMap.get(goal.area_id) && (
                              <Badge variant="outline">{areaNameMap.get(goal.area_id)}</Badge>
                            )}
                            <span className="text-muted-foreground">
                              Progresso: {goal.current_value}
                              {goal.target_value !== null ? ` / ${goal.target_value}` : ""}
                              {goal.unit ? ` ${goal.unit}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditGoalDialog(goal);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteGoal(goal);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {!selectedGoal ? (
              <Card className="p-8 text-center text-muted-foreground">
                Selecione uma meta para visualizar atividades e histórico de progresso.
              </Card>
            ) : (
              <>
                <Card className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{selectedGoal.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cadência: {selectedGoal.cadence} • Status: {statusLabel[selectedGoal.status]}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Período</p>
                      <p className="text-sm">
                        {formatDate(selectedGoal.start_date)} até {formatDate(selectedGoal.end_date)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Progresso atual</p>
                      <p className="text-sm font-medium">
                        {selectedGoal.current_value}
                        {selectedGoal.target_value !== null ? ` / ${selectedGoal.target_value}` : ""}
                        {selectedGoal.unit ? ` ${selectedGoal.unit}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Atualizar progresso</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={progressValue}
                        onChange={(event) => setProgressValue(event.target.value)}
                        disabled={!canEdit || updateProgressMutation.isPending}
                      />
                      <Button
                        type="button"
                        onClick={() => updateProgressMutation.mutate()}
                        disabled={!canEdit || updateProgressMutation.isPending}
                      >
                        {updateProgressMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Atividades</h3>
                    <Badge variant="outline">{activitiesQuery.data?.length || 0}</Badge>
                  </div>

                  {(canCreate || canEdit) && (
                    <div className="space-y-2 border rounded-md p-3">
                      <Input
                        placeholder="Título da atividade"
                        value={activityTitle}
                        onChange={(event) => setActivityTitle(event.target.value)}
                      />
                      <Textarea
                        placeholder="Descrição (opcional)"
                        value={activityDescription}
                        onChange={(event) => setActivityDescription(event.target.value)}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Peso"
                          value={activityWeight}
                          onChange={(event) => setActivityWeight(event.target.value)}
                        />
                        <Input
                          type="date"
                          value={activityDueDate}
                          onChange={(event) => setActivityDueDate(event.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => createActivityMutation.mutate()}
                        disabled={createActivityMutation.isPending}
                      >
                        {createActivityMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Adicionar atividade"
                        )}
                      </Button>
                    </div>
                  )}

                  {activitiesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando atividades...
                    </div>
                  ) : activitiesQuery.data?.length ? (
                    <div className="space-y-2">
                      {activitiesQuery.data.map((activity) => (
                        <div key={activity.id} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{activity.title}</p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                              )}
                            </div>
                            {canDelete && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => deleteActivityMutation.mutate(activity.id)}
                                className="text-destructive hover:text-destructive"
                                disabled={deleteActivityMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">Peso {activity.weight}</Badge>
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(activity.due_date)}
                            </span>
                          </div>

                          <Select
                            value={activity.status}
                            onValueChange={(value) =>
                              updateActivityMutation.mutate({
                                activityId: activity.id,
                                status: value as GoalActivity["status"],
                              })
                            }
                            disabled={!canEdit || updateActivityMutation.isPending}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue>{activityStatusLabel[activity.status]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="in_progress">Em andamento</SelectItem>
                              <SelectItem value="completed">Concluída</SelectItem>
                              <SelectItem value="cancelled">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada para esta meta.</p>
                  )}
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Histórico de progresso</h3>
                    <Badge variant="outline">{updatesQuery.data?.length || 0}</Badge>
                  </div>

                  {updatesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando histórico...
                    </div>
                  ) : updatesQuery.data?.length ? (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {updatesQuery.data.map((update) => (
                        <div key={update.id} className="border rounded-md p-3">
                          <p className="text-sm font-medium">Valor: {update.value}</p>
                          {update.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{update.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(update.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem registros de progresso para esta meta.</p>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      <GoalAgentPanel
        companyId={selectedCompanyId}
        open={agentOpen}
        onOpenChange={setAgentOpen}
        onMutationComplete={() => {
          queryClient.invalidateQueries({ queryKey: goalsKey });
          queryClient.invalidateQueries({ queryKey: activitiesKey });
          queryClient.invalidateQueries({ queryKey: updatesKey });
        }}
      />

      <Dialog
        open={goalDialogOpen}
        onOpenChange={(open) => {
          setGoalDialogOpen(open);
          if (!open) closeGoalDialog();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label>Título</Label>
              <Input
                value={goalFormData.title}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Ex.: Aumentar margem operacional"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={goalFormData.description}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Contexto e escopo da meta"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={goalFormData.type}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, type: value as Goal["type"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numérica</SelectItem>
                  <SelectItem value="activity">Atividade</SelectItem>
                  <SelectItem value="hybrid">Híbrida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pilar</Label>
              <Select
                value={goalFormData.pillar}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, pillar: value as GoalFormData["pillar"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pilar</SelectItem>
                  <SelectItem value="FAT">FAT</SelectItem>
                  <SelectItem value="RT">RT</SelectItem>
                  <SelectItem value="MS">MS</SelectItem>
                  <SelectItem value="SC">SC</SelectItem>
                  <SelectItem value="DN">DN</SelectItem>
                  <SelectItem value="CO">CO</SelectItem>
                  <SelectItem value="ESG">ESG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Área</Label>
              <Select
                value={goalFormData.area_id}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, area_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem área</SelectItem>
                  {(areasQuery.data || []).map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input
                value={goalFormData.unit}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, unit: event.target.value }))
                }
                placeholder="Ex.: %, R$, unidades"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Atual</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={goalFormData.current_value}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, current_value: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Alvo</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={goalFormData.target_value}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, target_value: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={goalFormData.start_date}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, start_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={goalFormData.end_date}
                onChange={(event) =>
                  setGoalFormData((prev) => ({ ...prev, end_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Cadência</Label>
              <Select
                value={goalFormData.cadence}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, cadence: value as Goal["cadence"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="activity">Atividade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={goalFormData.status}
                onValueChange={(value) =>
                  setGoalFormData((prev) => ({ ...prev, status: value as Goal["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={closeGoalDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveGoalMutation.mutate()}
              disabled={
                saveGoalMutation.isPending || (!editingGoal && !canCreate) || (Boolean(editingGoal) && !canEdit)
              }
            >
              {saveGoalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingGoal ? (
                "Salvar"
              ) : (
                "Criar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
