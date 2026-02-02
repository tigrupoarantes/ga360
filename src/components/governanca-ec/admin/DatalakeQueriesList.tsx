import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DatalakeQueryForm } from "./DatalakeQueryForm";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  FileText,
  Play,
  Loader2,
  Database
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

export function DatalakeQueriesList() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: queries, isLoading } = useQuery({
    queryKey: ['dl-queries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_queries')
        .select(`
          *,
          connection:dl_connections(name, base_url)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('dl_queries')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dl-queries'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar query');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dl_queries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Query removida');
      queryClient.invalidateQueries({ queryKey: ['dl-queries'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao remover query');
    },
  });

  const testMutation = useMutation({
    mutationFn: async (query: any) => {
      setTestingId(query.id);
      
      const { data, error } = await supabase.functions.invoke('execute-datalake-query', {
        body: {
          query_id: query.id,
          params: {},
          test_mode: true,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Teste executado! ${data.rows_count || 0} registro(s) retornado(s)`);
    },
    onError: (error: any) => {
      toast.error(`Erro no teste: ${error.message}`);
    },
    onSettled: () => {
      setTestingId(null);
    },
  });

  const handleEdit = (query: any) => {
    setEditingQuery(query);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingQuery(null);
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
          <h3 className="text-lg font-semibold">Queries / Endpoints</h3>
          <p className="text-sm text-muted-foreground">
            Configure os endpoints da API Proxy que serão consumidos
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Query
        </Button>
      </div>

      {queries && queries.length > 0 ? (
        <div className="grid gap-4">
          {queries.map((query) => (
            <Card key={query.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{query.name}</h4>
                      <Badge variant={query.is_enabled ? 'default' : 'secondary'}>
                        {query.is_enabled ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">{query.method}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {query.connection?.name}
                      </span>
                      <span className="font-mono text-xs">{query.endpoint_path}</span>
                    </div>
                    {query.description && (
                      <p className="text-xs text-muted-foreground mt-1">{query.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate(query)}
                    disabled={testingId === query.id}
                  >
                    {testingId === query.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Switch
                    checked={query.is_enabled}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ id: query.id, is_enabled: checked })
                    }
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(query)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setDeleteId(query.id)}
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
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma query configurada</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Crie queries para consumir dados da sua API Proxy.
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Query
          </Button>
        </Card>
      )}

      <DatalakeQueryForm
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        query={editingQuery}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta query? 
              Todos os vínculos com cards serão removidos.
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
