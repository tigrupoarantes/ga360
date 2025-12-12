import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, TrendingUp, Target } from "lucide-react";
import { GoalFormDialog } from "./GoalFormDialog";
import { GoalEntryDialog } from "./GoalEntryDialog";
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

interface Goal {
  id: string;
  name: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: string;
  period_type: string;
  notes: string | null;
  goal_type_id: string | null;
  area_id: string | null;
  responsible_id: string | null;
  goal_types?: { name: string; unit: string } | null;
  areas?: { name: string } | null;
  profiles?: { first_name: string; last_name: string } | null;
}

export function GoalsList() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoalForEntry, setSelectedGoalForEntry] = useState<Goal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchGoals = async () => {
    if (!selectedCompanyId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let query = supabase
      .from("goals")
      .select("*, goal_types(name, unit), areas(name)")
      .eq("company_id", selectedCompanyId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (data) setGoals(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchGoals();
  }, [selectedCompanyId, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("goals").delete().eq("id", deleteId);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Meta excluída com sucesso" });
      fetchGoals();
    }
    setDeleteId(null);
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const handleAddEntry = (goal: Goal) => {
    setSelectedGoalForEntry(goal);
    setEntryOpen(true);
  };

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para gerenciar as metas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditingGoal(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                <div className="h-2 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma meta encontrada</p>
            <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const progress = Math.min(100, (goal.current_value / goal.target_value) * 100);

            return (
              <Card key={goal.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        {goal.goal_types && (
                          <Badge variant="outline">{goal.goal_types.name}</Badge>
                        )}
                        {goal.areas && (
                          <Badge variant="secondary">{goal.areas.name}</Badge>
                        )}
                        <Badge variant={
                          goal.status === "active" ? "default" : 
                          goal.status === "completed" ? "secondary" : "destructive"
                        }>
                          {goal.status === "active" ? "Ativa" : 
                           goal.status === "completed" ? "Concluída" : "Cancelada"}
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddEntry(goal)}
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Lançar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(goal)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(goal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Progress value={progress} className="flex-1" />
                      <span className="text-sm font-medium w-16 text-right">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        Atual: {goal.current_value.toLocaleString()}
                        {goal.goal_types?.unit && ` ${goal.goal_types.unit}`}
                      </span>
                      <span>
                        Meta: {goal.target_value.toLocaleString()}
                        {goal.goal_types?.unit && ` ${goal.goal_types.unit}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Início: {new Date(goal.start_date).toLocaleDateString('pt-BR')}</span>
                      <span>Fim: {new Date(goal.end_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editingGoal}
        onSuccess={fetchGoals}
      />

      <GoalEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        goal={selectedGoalForEntry}
        onSuccess={fetchGoals}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os lançamentos associados também serão excluídos.
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
