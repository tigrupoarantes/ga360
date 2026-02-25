import { useEffect, useMemo, useState } from "react";
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
import { Plus, Search, Loader2, Pencil, Trash2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

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

interface AreaOption {
  id: string;
  name: string;
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

const defaultFormData: GoalFormData = {
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

export default function Metas() {
  const { toast } = useToast();
  const { checkPermission } = useAuth();
  const { selectedCompanyId } = useCompany();

  const canCreate = checkPermission("metas", "create");
  const canEdit = checkPermission("metas", "edit");
  const canDelete = checkPermission("metas", "delete");

  const [goals, setGoals] = useState<Goal[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState<GoalFormData>(defaultFormData);

  const areaNameMap = useMemo(
    () => new Map(areas.map((area) => [area.id, area.name])),
    [areas]
  );

  const filteredGoals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return goals.filter((goal) => {
      const statusMatch = statusFilter === "all" || goal.status === statusFilter;
      const searchMatch =
        term.length === 0 ||
        goal.title.toLowerCase().includes(term) ||
        (goal.description ?? "").toLowerCase().includes(term);

      return statusMatch && searchMatch;
    });
  }, [goals, searchTerm, statusFilter]);

  const fetchAreas = async () => {
    try {
      let query = (supabase as any)
        .from("areas")
        .select("id, name")
        .order("name", { ascending: true });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setAreas((data || []) as AreaOption[]);
    } catch (error) {
      console.error("Erro ao carregar áreas:", error);
      setAreas([]);
    }
  };

  const fetchGoals = async () => {
    try {
      setLoading(true);

      let query = (supabase as any)
        .from("goals")
        .select("id, company_id, area_id, title, description, type, pillar, unit, target_value, current_value, start_date, end_date, cadence, status, created_at")
        .order("created_at", { ascending: false });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setGoals((data || []) as Goal[]);
    } catch (error) {
      console.error("Erro ao carregar metas:", error);
      toast({
        title: "Erro ao carregar metas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
    fetchGoals();
  }, [selectedCompanyId]);

  const resetDialog = () => {
    setEditingGoal(null);
    setFormData(defaultFormData);
  };

  const openCreateDialog = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEditDialog = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description ?? "",
      type: goal.type,
      pillar: goal.pillar ?? "none",
      unit: goal.unit ?? "",
      target_value: goal.target_value?.toString() ?? "",
      current_value: goal.current_value.toString(),
      start_date: goal.start_date ?? "",
      end_date: goal.end_date ?? "",
      cadence: goal.cadence,
      status: goal.status,
      area_id: goal.area_id ?? "none",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Informe o título da meta",
        variant: "destructive",
      });
      return;
    }

    if (!editingGoal && !selectedCompanyId) {
      toast({
        title: "Selecione uma empresa para criar a meta",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        pillar: formData.pillar === "none" ? null : formData.pillar,
        unit: formData.unit.trim() || null,
        target_value: formData.target_value === "" ? null : Number(formData.target_value),
        current_value: Number(formData.current_value || 0),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        cadence: formData.cadence,
        status: formData.status,
        area_id: formData.area_id === "none" ? null : formData.area_id,
      };

      if (editingGoal) {
        const { error } = await (supabase as any)
          .from("goals")
          .update(payload)
          .eq("id", editingGoal.id);

        if (error) throw error;

        toast({ title: "Meta atualizada com sucesso" });
      } else {
        const { error } = await (supabase as any)
          .from("goals")
          .insert({
            ...payload,
            company_id: selectedCompanyId,
          });

        if (error) throw error;

        toast({ title: "Meta criada com sucesso" });
      }

      setDialogOpen(false);
      resetDialog();
      fetchGoals();
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
      toast({
        title: "Erro ao salvar meta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (goal: Goal) => {
    if (!canDelete) return;

    const confirmed = window.confirm(`Deseja excluir a meta \"${goal.title}\"?`);
    if (!confirmed) return;

    try {
      const { error } = await (supabase as any).from("goals").delete().eq("id", goal.id);
      if (error) throw error;

      toast({ title: "Meta excluída" });
      fetchGoals();
    } catch (error) {
      console.error("Erro ao excluir meta:", error);
      toast({
        title: "Erro ao excluir meta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Metas</h1>
            <p className="text-muted-foreground mt-1">
              Gestão inicial do portal de metas (Fase 2)
            </p>
          </div>

          {canCreate && (
            <Button onClick={openCreateDialog} className="gap-2" disabled={!selectedCompanyId}>
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
          )}
        </div>

        {!selectedCompanyId && (
          <Card className="p-4 text-sm text-muted-foreground">
            Selecione uma empresa no topo para criar metas. A listagem abaixo mostra metas
            das empresas às quais você tem acesso.
          </Card>
        )}

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

        {loading ? (
          <Card className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando metas...
          </Card>
        ) : filteredGoals.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhuma meta encontrada.
          </Card>
        ) : (
          <div className="grid gap-4 animate-fade-in-up">
            {filteredGoals.map((goal) => (
              <Card key={goal.id} className="p-4">
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
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(goal)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(goal)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
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
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex.: Aumentar margem operacional"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Contexto e escopo da meta"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, type: value as Goal["type"] }))
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
                value={formData.pillar}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, pillar: value as GoalFormData["pillar"] }))
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
                value={formData.area_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, area_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem área</SelectItem>
                  {areas.map((area) => (
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
                value={formData.unit}
                onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
                placeholder="Ex.: %, R$, unidades"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Atual</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.current_value}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, current_value: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Alvo</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.target_value}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, target_value: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, start_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(event) => setFormData((prev) => ({ ...prev, end_date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Cadência</Label>
              <Select
                value={formData.cadence}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, cadence: value as Goal["cadence"] }))
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
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value as Goal["status"] }))
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!editingGoal && !canCreate) || (Boolean(editingGoal) && !canEdit)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingGoal ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
