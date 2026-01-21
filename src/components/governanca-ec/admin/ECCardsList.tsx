import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ECCardForm } from "./ECCardForm";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  LayoutGrid,
  Loader2
} from "lucide-react";
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

const periodicityLabels: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  manual_trigger: 'Manual',
};

export function ECCardsList() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('all');

  const { data: areas } = useQuery({
    queryKey: ['ec-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_areas')
        .select('*')
        .order('order');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: cards, isLoading } = useQuery({
    queryKey: ['ec-cards-admin', areaFilter],
    queryFn: async () => {
      let query = supabase
        .from('ec_cards')
        .select(`
          *,
          area:ec_areas(id, name),
          responsible:profiles!ec_cards_responsible_id_fkey(id, first_name, last_name)
        `)
        .order('order');
      
      if (areaFilter !== 'all') {
        query = query.eq('area_id', areaFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ec_cards')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec-cards-admin'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar card');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ec_cards')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Card removido');
      queryClient.invalidateQueries({ queryKey: ['ec-cards-admin'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao remover card');
    },
  });

  const handleEdit = (card: any) => {
    setEditingCard(card);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCard(null);
  };

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">Cards de Governança EC</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie os cards de cada área
            </p>
          </div>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {areas?.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Card
        </Button>
      </div>

      {cards && cards.length > 0 ? (
        <div className="grid gap-4">
          {cards.map((card) => (
            <Card key={card.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{card.title}</h4>
                      <Badge variant={card.is_active ? 'default' : 'secondary'}>
                        {card.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        {periodicityLabels[card.periodicity_type] || card.periodicity_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{card.area?.name}</span>
                      {card.responsible && (
                        <span>
                          Responsável: {card.responsible.first_name} {card.responsible.last_name}
                        </span>
                      )}
                    </div>
                    {card.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {card.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={card.is_active}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ id: card.id, is_active: checked })
                    }
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(card)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setDeleteId(card.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhum card configurado</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Crie cards para as áreas de Governança EC.
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Card
          </Button>
        </Card>
      )}

      <ECCardForm
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        card={editingCard}
        areas={areas || []}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este card? 
              Todos os registros e evidências associados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
