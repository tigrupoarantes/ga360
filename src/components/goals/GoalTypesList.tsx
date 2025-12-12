import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { GoalTypeFormDialog } from "./GoalTypeFormDialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GoalType {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  calculation_type: string;
  is_active: boolean;
}

export function GoalTypesList() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const [types, setTypes] = useState<GoalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<GoalType | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTypes = async () => {
    if (!selectedCompanyId) {
      setTypes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("goal_types")
      .select("*")
      .eq("company_id", selectedCompanyId)
      .order("name");

    if (data) setTypes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTypes();
  }, [selectedCompanyId]);

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("goal_types").delete().eq("id", deleteId);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tipo de meta excluído" });
      fetchTypes();
    }
    setDeleteId(null);
  };

  const handleEdit = (type: GoalType) => {
    setEditingType(type);
    setFormOpen(true);
  };

  const toggleActive = async (type: GoalType) => {
    const { error } = await supabase
      .from("goal_types")
      .update({ is_active: !type.is_active })
      .eq("id", type.id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      fetchTypes();
    }
  };

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para gerenciar os tipos de meta</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tipos de Meta</h2>
          <p className="text-sm text-muted-foreground">
            Configure os tipos de meta disponíveis para esta empresa
          </p>
        </div>
        <Button onClick={() => { setEditingType(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo
        </Button>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-8">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        ) : types.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum tipo de meta cadastrado</p>
            <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro tipo
            </Button>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Cálculo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map(type => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      {type.description && (
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{type.unit || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {type.calculation_type === "sum" ? "Soma" :
                       type.calculation_type === "avg" ? "Média" :
                       type.calculation_type === "last" ? "Último" :
                       type.calculation_type === "max" ? "Máximo" : "Mínimo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={type.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(type)}
                    >
                      {type.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(type.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <GoalTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goalType={editingType}
        onSuccess={fetchTypes}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tipo de Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Metas associadas a este tipo perderão a referência.
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
