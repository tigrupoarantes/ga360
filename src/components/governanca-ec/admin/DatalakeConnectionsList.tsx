import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DatalakeConnectionForm } from "./DatalakeConnectionForm";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Database,
  Globe,
  Key,
  Loader2,
  RefreshCw
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

function getProbePayload(connection: any) {
  const baseUrl = String(connection?.base_url || "").toLowerCase();
  const name = String(connection?.name || "").toLowerCase();
  const isEmployeesEndpoint = baseUrl.includes("funcionarios") || name.includes("funcion");

  if (isEmployeesEndpoint) {
    return {
      path: "funcionarios",
      query: { $first: 1 },
      connectionId: connection.id,
    };
  }

  return {
    path: "self",
    connectionId: connection.id,
  };
}

export function DatalakeConnectionsList() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { ok: boolean | null; message?: string }>>({});
  const [testingConnections, setTestingConnections] = useState(false);

  const { data: connections, isLoading } = useQuery({
    queryKey: ['dl-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_connections')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('dl_connections')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dl-connections'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar conexão');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dl_connections')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conexão removida');
      queryClient.invalidateQueries({ queryKey: ['dl-connections'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Erro ao remover conexão');
    },
  });

  const handleEdit = (connection: any) => {
    setEditingConnection(connection);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingConnection(null);
  };

  const testConnectionHealth = async (connection: any) => {
    if (!connection.is_enabled) {
      return { ok: null, message: 'Conexão inativa' };
    }

    try {
      const probePayload = getProbePayload(connection);

      const firstAttempt = await supabase.functions.invoke("dab-proxy", {
        body: probePayload,
      });

      let invokeError = firstAttempt.error;

      if (invokeError) {
        const fallbackPayload = probePayload.path === "funcionarios"
          ? { path: "funcionarios", connectionId: connection.id }
          : probePayload;

        const fallbackAttempt = await supabase.functions.invoke("dab-proxy", {
          body: fallbackPayload,
        });
        invokeError = fallbackAttempt.error;
      }

      if (invokeError) {
        const status = invokeError.context?.status;
        let detailsMessage = '';

        try {
          if (invokeError.context) {
            const details = await invokeError.context.json();
            detailsMessage = details?.details?.error || details?.details?.message || details?.error || '';
          }
        } catch {
          detailsMessage = '';
        }

        return {
          ok: false,
          message: status
            ? `${`HTTP ${status}`}${detailsMessage ? ` - ${detailsMessage}` : ''}`
            : (invokeError.message || 'Erro na conexão'),
        };
      }

      return { ok: true, message: 'Conexão ativa' };
    } catch (error: any) {
      return {
        ok: false,
        message: error?.message || 'Falha ao testar conexão',
      };
    }
  };

  const testAllConnections = async () => {
    if (!connections || connections.length === 0) return;

    setTestingConnections(true);
    try {
      const statusEntries = await Promise.all(
        connections.map(async (connection) => {
          const result = await testConnectionHealth(connection);
          return [connection.id, result] as const;
        }),
      );

      setConnectionStatus(Object.fromEntries(statusEntries));
      toast.success("Teste de conexões finalizado");
    } catch (error) {
      toast.error("Erro ao testar conexões");
    } finally {
      setTestingConnections(false);
    }
  };

  useEffect(() => {
    if (!connections || connections.length === 0) return;
    testAllConnections();
  }, [connections]);

  const renderStatus = (connection: any) => {
    const status = connectionStatus[connection.id];

    if (!connection.is_enabled) {
      return (
        <Badge variant="secondary">Inativa</Badge>
      );
    }

    if (status?.ok === true) {
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-600" title={status.message}>● Online</Badge>
      );
    }

    if (status?.ok === false) {
      return (
        <Badge variant="destructive" title={status.message || 'Sem detalhes'}>● Offline</Badge>
      );
    }

    return (
      <Badge variant="outline">Testando...</Badge>
    );
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
          <h3 className="text-lg font-semibold">Conexões com API Proxy</h3>
          <p className="text-sm text-muted-foreground">
            Configure as conexões com seu servidor de dados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={testAllConnections} disabled={testingConnections || isLoading}>
            {testingConnections ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Testar conexões
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conexão
          </Button>
        </div>
      </div>

      {connections && connections.length > 0 ? (
        <div className="grid gap-4">
          {connections.map((conn) => (
            <Card key={conn.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{conn.name}</h4>
                      <Badge variant={conn.is_enabled ? 'default' : 'secondary'}>
                        {conn.is_enabled ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {renderStatus(conn)}
                      <Badge variant="outline">{conn.type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {conn.base_url}
                      </span>
                      <span className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        {conn.auth_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={conn.is_enabled}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ id: conn.id, is_enabled: checked })
                    }
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(conn)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setDeleteId(conn.id)}
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
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma conexão configurada</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Crie uma conexão com sua API Proxy para começar a integrar dados.
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Conexão
          </Button>
        </Card>
      )}

      <DatalakeConnectionForm
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        connection={editingConnection}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conexão? 
              Todas as queries e vínculos associados também serão removidos.
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
