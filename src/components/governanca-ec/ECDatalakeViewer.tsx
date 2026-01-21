import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Database, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ECDatalakeViewerProps {
  cardId: string;
  bindings: any[];
  record?: any;
}

export function ECDatalakeViewer({ cardId, bindings, record }: ECDatalakeViewerProps) {
  const queryClient = useQueryClient();
  const [refreshingQuery, setRefreshingQuery] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: async (binding: any) => {
      setRefreshingQuery(binding.id);
      
      // Chamar edge function para executar a query
      const { data, error } = await supabase.functions.invoke('execute-datalake-query', {
        body: {
          query_id: binding.query_id,
          card_id: cardId,
          binding_id: binding.id,
          params: binding.params_mapping_json || {},
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Dados atualizados com sucesso');
      queryClient.invalidateQueries({ queryKey: ['ec-card-records', cardId] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar dados do datalake');
      console.error(error);
    },
    onSettled: () => {
      setRefreshingQuery(null);
    },
  });

  if (bindings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Sem Vínculo com Datalake</h3>
        <p className="text-muted-foreground text-sm">
          Este card não possui queries configuradas. 
          Acesse Admin &gt; Governança EC &gt; Vínculos para configurar.
        </p>
      </Card>
    );
  }

  const snapshotData = record?.datalake_snapshot_json || {};

  return (
    <div className="space-y-4">
      {bindings.map((binding) => {
        const queryData = snapshotData[binding.query_id];
        const isRefreshing = refreshingQuery === binding.id;

        return (
          <Card key={binding.id} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="font-semibold">{binding.query?.name || 'Query'}</h4>
                  <p className="text-xs text-muted-foreground">
                    {binding.query?.endpoint_path}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {binding.refresh_policy === 'manual' ? 'Manual' : 
                   binding.refresh_policy === 'hourly' ? 'A cada hora' : 'Diário'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshMutation.mutate(binding)}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {queryData ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">
                    Atualizado em {queryData.fetched_at 
                      ? format(new Date(queryData.fetched_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : 'N/A'}
                  </span>
                </div>

                {queryData.error ? (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Erro na última execução</span>
                    </div>
                    <p className="text-sm mt-1">{queryData.error}</p>
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-3">
                    {binding.mapping_json && binding.mapping_json.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {binding.mapping_json.map((mapping: any) => {
                          const value = queryData.data?.[mapping.output_field];
                          return (
                            <div key={mapping.output_field} className="bg-background p-3 rounded">
                              <p className="text-xs text-muted-foreground">{mapping.label || mapping.output_field}</p>
                              <p className="font-semibold text-lg">
                                {value !== undefined ? (
                                  mapping.format === 'currency' 
                                    ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : mapping.format === 'percentage'
                                    ? `${Number(value).toFixed(2)}%`
                                    : String(value)
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <pre className="text-sm overflow-auto max-h-48">
                        {JSON.stringify(queryData.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-muted-foreground text-sm">
                  Nenhum dado disponível. Clique em atualizar para buscar.
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
