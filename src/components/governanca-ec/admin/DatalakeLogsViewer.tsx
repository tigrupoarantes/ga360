import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, RefreshCw, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "dd/MM HH:mm:ss", { locale: ptBR });
}

function formatJson(value: unknown) {
  if (!value) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusBadge(status?: string | null) {
  if (status === "success") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Sucesso
      </Badge>
    );
  }

  if (status === "partial") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        <Clock className="h-3 w-3 mr-1" />
        Parcial
      </Badge>
    );
  }

  if (status === "error") {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
        <XCircle className="h-3 w-3 mr-1" />
        Erro
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      <Clock className="h-3 w-3 mr-1" />
      {status === "running" ? "Executando" : "Pendente"}
    </Badge>
  );
}

function formatError(err: unknown) {
  if (!err) return "-";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function DatalakeLogsViewer() {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedSyncId, setExpandedSyncId] = useState<string | null>(null);

  const {
    data: syncLogs,
    isLoading: isLoadingSyncLogs,
    refetch: refetchSyncLogs,
    isRefetching: isRefetchingSyncLogs,
    error: syncLogsError,
  } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select(
          `
          id,
          company_id,
          completed_at,
          records_created,
          records_failed,
          records_received,
          records_updated,
          started_at,
          status,
          sync_type
        `,
        )
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const {
    data: queryRuns,
    isLoading: isLoadingQueryRuns,
    refetch: refetchQueryRuns,
    isRefetching: isRefetchingQueryRuns,
    error: queryRunsError,
  } = useQuery({
    queryKey: ["dl-query-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dl_query_runs")
        .select(
          `
          id,
          query_id,
          card_id,
          status,
          started_at,
          finished_at,
          duration_ms,
          rows_returned,
          error_message,
          query:dl_queries(name),
          card:ec_cards(title)
        `,
        )
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: expandedSyncDetail, isFetching: isFetchingSyncDetail } = useQuery({
    queryKey: ["sync-log-detail", expandedSyncId],
    enabled: Boolean(expandedSyncId),
    queryFn: async () => {
      const { data, error } = await supabase.from("sync_logs").select("id, errors").eq("id", expandedSyncId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: expandedRunDetail, isFetching: isFetchingRunDetail } = useQuery({
    queryKey: ["dl-query-run-detail", expandedRunId],
    enabled: Boolean(expandedRunId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dl_query_runs")
        .select("id, params_used_json, response_snapshot_json, error_message")
        .eq("id", expandedRunId as string)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingSyncLogs || isLoadingQueryRuns;
  const isRefetching = isRefetchingSyncLogs || isRefetchingQueryRuns;

  const handleRefresh = async () => {
    await Promise.all([refetchSyncLogs(), refetchQueryRuns()]);
  };

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
          <p className="text-sm text-muted-foreground">Histórico das últimas 100 execuções</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b">
          <h4 className="font-semibold">Sincronizações (`sync_logs`)</h4>
          <p className="text-xs text-muted-foreground mt-1">Totais de recebidos/criados/atualizados/falhas e detalhes de erro.</p>
          {syncLogsError ? (
            <p className="text-xs text-destructive mt-2">Falha ao carregar `sync_logs`: {formatError(syncLogsError)}</p>
          ) : null}
        </div>

        {!syncLogsError && syncLogs && syncLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Recebidos</TableHead>
                <TableHead>Criados</TableHead>
                <TableHead>Atualizados</TableHead>
                <TableHead>Falhas</TableHead>
                <TableHead className="w-[80px]">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncLogs.map((log: any) => {
                const isExpanded = expandedSyncId === log.id;
                const companyLabel = log.company_id ? String(log.company_id) : "-";

                return (
                  <Fragment key={log.id}>
                    <TableRow>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="font-medium">{log.sync_type || "-"}</TableCell>
                      <TableCell className="font-mono text-xs break-all">{companyLabel}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.started_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.completed_at)}</TableCell>
                      <TableCell>{log.records_received ?? "-"}</TableCell>
                      <TableCell>{log.records_created ?? "-"}</TableCell>
                      <TableCell>{log.records_updated ?? "-"}</TableCell>
                      <TableCell className="text-destructive">{log.records_failed ?? "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedSyncId(isExpanded ? null : log.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isExpanded ? (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <div className="space-y-3 py-2">
                            <div className="grid gap-2 text-xs md:grid-cols-3">
                              <div className="rounded border p-2">
                                <span className="text-muted-foreground">ID:</span>
                                <p className="font-mono break-all">{String(log.id)}</p>
                              </div>
                              <div className="rounded border p-2">
                                <span className="text-muted-foreground">Status:</span>
                                <p>{log.status || "-"}</p>
                              </div>
                              <div className="rounded border p-2">
                                <span className="text-muted-foreground">Company ID:</span>
                                <p className="font-mono break-all">{companyLabel}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">`errors`</p>
                              <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto max-h-72">
                                {isFetchingSyncDetail && !expandedSyncDetail ? "Carregando detalhes..." : formatJson(expandedSyncDetail?.errors)}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        ) : !syncLogsError ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum log em `sync_logs`.</div>
        ) : null}
      </Card>

      <Card>
        <div className="p-4 border-b">
          <h4 className="font-semibold">Execuções de Query (`dl_query_runs`)</h4>
          <p className="text-xs text-muted-foreground mt-1">Parâmetros usados e snapshot do retorno (lazy-load ao expandir).</p>
          {queryRunsError ? <p className="text-xs text-destructive mt-2">Falha ao carregar `dl_query_runs`.</p> : null}
        </div>

        {queryRuns && queryRuns.length > 0 ? (
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
                <TableHead className="w-[80px]">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queryRuns.map((log: any) => {
                const isExpanded = expandedRunId === log.id;
                return (
                  <Fragment key={log.id}>
                    <TableRow>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                      <TableCell className="font-medium">{log.query?.name || "-"}</TableCell>
                      <TableCell>{log.card?.title || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.started_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.duration_ms ? `${log.duration_ms}ms` : "-"}</TableCell>
                      <TableCell>{log.rows_returned ?? "-"}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-destructive">{log.error_message || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedRunId(isExpanded ? null : log.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isExpanded ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="space-y-3 py-2">
                            <div className="grid gap-2 text-xs md:grid-cols-3">
                              <div className="rounded border p-2">
                                <span className="text-muted-foreground">ID:</span>
                                <p className="font-mono break-all">{String(log.id)}</p>
                              </div>
                              <div className="rounded border p-2">
                                <span className="text-muted-foreground">Query ID:</span>
                                <p className="font-mono break-all">{String(log.query_id || "-")}</p>
                              </div>
                              <div className="rounded border p-2">
                                <span className="text-muted-foreground">Card ID:</span>
                                <p className="font-mono break-all">{String(log.card_id || "-")}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">`error_message`</p>
                              <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto max-h-72">
                                {isFetchingRunDetail && !expandedRunDetail ? "Carregando detalhes..." : (expandedRunDetail?.error_message ? String(expandedRunDetail.error_message) : "-")}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">`params_used_json`</p>
                              <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto max-h-72">
                                {isFetchingRunDetail && !expandedRunDetail ? "Carregando detalhes..." : formatJson(expandedRunDetail?.params_used_json)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">`response_snapshot_json`</p>
                              <pre className="rounded border bg-muted/40 p-3 text-xs overflow-auto max-h-72">
                                {isFetchingRunDetail && !expandedRunDetail ? "Carregando detalhes..." : formatJson(expandedRunDetail?.response_snapshot_json)}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Nenhum log em `dl_query_runs`.</div>
        )}
      </Card>
    </div>
  );
}
