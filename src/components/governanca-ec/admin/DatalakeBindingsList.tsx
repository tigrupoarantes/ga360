import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DatalakeBindingForm } from "./DatalakeBindingForm";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Link2,
  Loader2,
  ArrowRight
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

export function DatalakeBindingsList() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: bindings, isLoading } = useQuery({
    queryKey: ['dl-bindings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_card_bindings')
        .select(`
          *,
          card:ec_cards(id, title, area:ec_areas(name)),
          query:dl_queries(id, name, endpoint_path)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('dl_card_bindings')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dl-bindings'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar vínculo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dl_card_bindings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vínculo removido');
      queryClient.invalidateQueries({ queryKey: ['dl-bindings'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao remover vínculo');
    },
  });

  const handleEdit = (binding: any) => {
    setEditingBinding(binding);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBinding(null);
  };

  const refreshPolicyLabels: Record<string, string> = {
    manual: 'Manual',
    hourly: 'A cada hora',
    daily: 'Diário',
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
        <div>
          <h3 className="text-lg font-semibold">Vínculos Card ↔ Query</h3>
          <p className="text-sm text-muted-foreground">
            Configure quais dados do datalake aparecem em cada card
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Vínculo
        </Button>
      </div>

      {bindings && bindings.length > 0 ? (
        <div className="grid gap-4">
          {bindings.map((binding) => (
            <Card key={binding.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{binding.card?.area?.name}</p>
                      <p className="font-semibold">{binding.card?.title}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Query</p>
                      <p className="font-semibold">{binding.query?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {refreshPolicyLabels[binding.refresh_policy] || binding.refresh_policy}
                  </Badge>
                  <Badge variant={binding.is_enabled ? 'default' : 'secondary'}>
                    {binding.is_enabled ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Switch
                    checked={binding.is_enabled}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ id: binding.id, is_enabled: checked })
                    }
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(binding)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setDeleteId(binding.id)}
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
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhum vínculo configurado</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Vincule queries aos cards para exibir dados do datalake.
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Vínculo
          </Button>
        </Card>
      )}

      <DatalakeBindingForm
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        binding={editingBinding}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este vínculo?
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
