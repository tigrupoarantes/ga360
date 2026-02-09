import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/external-client";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/ui/back-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bug, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BugReport {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  page_url: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { first_name: string | null; last_name: string | null } | null;
}

const statusColors: Record<string, string> = {
  aberto: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  em_analise: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  resolvido: "bg-green-500/10 text-green-700 border-green-500/30",
  recusado: "bg-red-500/10 text-red-700 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  resolvido: "Resolvido",
  recusado: "Recusado",
};

const priorityColors: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-yellow-500/10 text-yellow-700",
  alta: "bg-orange-500/10 text-orange-700",
  critica: "bg-red-500/10 text-red-700",
};

export default function AdminBugReports() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const fetchReports = async () => {
    try {
      let query = supabase
        .from("bug_reports" as any)
        .select("*, profiles!bug_reports_user_id_fkey(first_name, last_name)")
        .order("created_at", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("type", filterType);
      }
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports((data as any) || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar reports", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterType, filterStatus]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("bug_reports" as any)
        .update({ status: newStatus } as any)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Status atualizado" });
      fetchReports();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const saveNotes = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bug_reports" as any)
        .update({ admin_notes: editingNotes[id] } as any)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Notas salvas" });
      fetchReports();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const totalAbertos = reports.filter((r) => r.status === "aberto").length;
  const totalBugs = reports.filter((r) => r.type === "bug").length;
  const totalMelhorias = reports.filter((r) => r.type === "melhoria").length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/admin" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bugs e Melhorias</h1>
            <p className="text-muted-foreground mt-1">Gerencie os reports dos usuários</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{totalAbertos}</p>
            <p className="text-sm text-muted-foreground">Abertos</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{totalBugs}</p>
            <p className="text-sm text-muted-foreground">Bugs</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalMelhorias}</p>
            <p className="text-sm text-muted-foreground">Melhorias</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="melhoria">Melhoria</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="resolvido">Resolvido</SelectItem>
              <SelectItem value="recusado">Recusado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum report encontrado
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <>
                    <TableRow
                      key={report.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                    >
                      <TableCell>
                        {report.type === "bug" ? (
                          <Bug className="h-4 w-4 text-red-500" />
                        ) : (
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.profiles
                          ? `${report.profiles.first_name || ""} ${report.profiles.last_name || ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={priorityColors[report.priority]}>
                          {report.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[report.status]}>
                          {statusLabels[report.status] || report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(report.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {expandedId === report.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === report.id && (
                      <TableRow key={`${report.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="space-y-4 p-4">
                            <div>
                              <p className="text-sm font-medium mb-1">Descrição</p>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {report.description}
                              </p>
                            </div>
                            {report.page_url && (
                              <div>
                                <p className="text-sm font-medium mb-1">Página</p>
                                <p className="text-sm text-muted-foreground">{report.page_url}</p>
                              </div>
                            )}
                            <div className="flex gap-4 items-end">
                              <div className="flex-1">
                                <p className="text-sm font-medium mb-1">Notas do Admin</p>
                                <Textarea
                                  value={editingNotes[report.id] ?? report.admin_notes ?? ""}
                                  onChange={(e) =>
                                    setEditingNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                                  }
                                  placeholder="Adicione notas internas..."
                                  rows={2}
                                />
                              </div>
                              <Button size="sm" onClick={() => saveNotes(report.id)}>
                                Salvar Notas
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              {["aberto", "em_analise", "resolvido", "recusado"].map((s) => (
                                <Button
                                  key={s}
                                  size="sm"
                                  variant={report.status === s ? "default" : "outline"}
                                  onClick={() => updateStatus(report.id, s)}
                                >
                                  {statusLabels[s]}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </MainLayout>
  );
}
