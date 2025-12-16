import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronDown, ChevronRight } from "lucide-react";
import { ObjectiveFormDialog } from "./ObjectiveFormDialog";
import { ObjectiveCard } from "./ObjectiveCard";
import { toast } from "sonner";

export function ObjectivesList() {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<any>(null);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  const { data: objectives, isLoading } = useQuery({
    queryKey: ["okr-objectives", selectedCompany?.id, levelFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("okr_objectives")
        .select(`
          *,
          okr_key_results (*),
          owner:profiles!okr_objectives_owner_id_fkey (first_name, last_name),
          area:areas (name),
          children:okr_objectives!okr_objectives_parent_id_fkey (
            id,
            title,
            progress,
            level,
            okr_key_results (*)
          )
        `)
        .is("parent_id", null)
        .order("created_at", { ascending: false });

      if (selectedCompany) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (levelFilter !== "all") {
        query = query.eq("level", levelFilter);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("okr_objectives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okr-objectives"] });
      toast.success("Objetivo excluído com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir objetivo");
    },
  });

  const filteredObjectives = objectives?.filter((o) =>
    o.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEdit = (objective: any) => {
    setEditingObjective(objective);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este objetivo?")) {
      deleteObjective.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingObjective(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar objetivos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="company">Empresa</SelectItem>
            <SelectItem value="area">Área</SelectItem>
            <SelectItem value="team">Time</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Objetivo
        </Button>
      </div>

      {/* Objectives List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredObjectives?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum objetivo encontrado
          </div>
        ) : (
          filteredObjectives?.map((objective) => (
            <div key={objective.id} className="space-y-2">
              <ObjectiveCard
                objective={objective}
                isExpanded={expandedObjectives.has(objective.id)}
                onToggleExpand={() => toggleExpand(objective.id)}
                onEdit={() => handleEdit(objective)}
                onDelete={() => handleDelete(objective.id)}
                hasChildren={(objective.children?.length || 0) > 0}
              />

              {/* Child objectives */}
              {expandedObjectives.has(objective.id) && objective.children?.map((child: any) => (
                <div key={child.id} className="ml-8">
                  <ObjectiveCard
                    objective={child}
                    isExpanded={false}
                    onToggleExpand={() => {}}
                    onEdit={() => handleEdit(child)}
                    onDelete={() => handleDelete(child.id)}
                    hasChildren={false}
                    isChild
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <ObjectiveFormDialog
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        objective={editingObjective}
        parentObjectives={objectives?.filter((o) => o.level !== "individual") || []}
      />
    </div>
  );
}
