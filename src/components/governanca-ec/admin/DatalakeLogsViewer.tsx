import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DatalakeLogsViewer() {
  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dl-query-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dl_query_runs')
        .select(`
          *,
          query:dl_queries(name),
          card:ec_cards(title)
        `)
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-96" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Logs de Execução</h3>
          <p className="text-sm text-muted-foreground">
            Histórico das últimas 100 execuções de queries
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        {logs && logs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.status === 'success' ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Sucesso
                      </Badge>
                    ) : log.status === 'error' ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        <XCircle className="h-3 w-3 mr-1" />
                        Erro
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.query?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {log.card?.title || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.started_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                  </TableCell>
                  <TableCell>
                    {log.rows_returned ?? '-'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-destructive">
                    {log.error_message || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhum log encontrado</h3>
            <p className="text-muted-foreground text-sm">
              Execute queries para ver os logs aqui.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
