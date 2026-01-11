import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Execution {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  notes: string | null;
  processes: { name: string } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

export function ProcessExecutionHistory() {
  const { selectedCompanyId } = useCompany();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processFilter, setProcessFilter] = useState<string>("all");
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setExecutions([]);
      setLoading(false);
      return;
    }

    const fetchProcesses = async () => {
      const { data } = await supabase
        .from("processes")
        .select("id, name")
        .eq("company_id", selectedCompanyId)
        .order("name");
      if (data) setProcesses(data);
    };

    fetchProcesses();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    const fetchExecutions = async () => {
      setLoading(true);
      
      let query = supabase
        .from("process_executions")
        .select(`
          id,
          started_at,
          completed_at,
          status,
          notes,
          processes!inner(name, company_id),
          profiles:executed_by(first_name, last_name)
        `)
        .eq("processes.company_id", selectedCompanyId)
        .order("started_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (processFilter !== "all") {
        query = query.eq("process_id", processFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching executions:", error);
      }
      
      if (data) {
        setExecutions(data as any);
      }
      setLoading(false);
    };

    fetchExecutions();
  }, [selectedCompanyId, statusFilter, processFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Concluído
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Cancelado
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Em Andamento
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDuration = (startedAt: string, completedAt: string | null): string => {
    if (!completedAt) return "-";
    const minutes = differenceInMinutes(new Date(completedAt), new Date(startedAt));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const getProfileName = (profile: { first_name: string | null; last_name: string | null } | null): string => {
    if (!profile) return "Desconhecido";
    const firstName = profile.first_name || "";
    const lastName = profile.last_name || "";
    return `${firstName} ${lastName}`.trim() || "Usuário";
  };

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para ver o histórico</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Concluídos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
          </SelectContent>
        </Select>

        <Select value={processFilter} onValueChange={setProcessFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Processo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os processos</SelectItem>
            {processes.map(process => (
              <SelectItem key={process.id} value={process.id}>
                {process.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Execuções
          </CardTitle>
          <CardDescription>
            Últimas 100 execuções de processos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma execução encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Executor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map(execution => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      {execution.processes?.name || "Processo removido"}
                    </TableCell>
                    <TableCell>
                      {getProfileName(execution.profiles)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(execution.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {getDuration(execution.started_at, execution.completed_at)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(execution.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
