import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStockAudits } from "@/hooks/useStockAudit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  Building2, 
  Calendar, 
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_CONFIG = {
  draft: { label: "Rascunho", color: "bg-gray-500", icon: FileText },
  in_progress: { label: "Em andamento", color: "bg-yellow-500", icon: Clock },
  completed: { label: "Concluída", color: "bg-green-500", icon: CheckCircle2 },
  reviewed: { label: "Revisada", color: "bg-blue-500", icon: CheckCircle2 },
};

export function AuditHistory() {
  const navigate = useNavigate();
  const { data: audits = [], isLoading } = useStockAudits();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma auditoria realizada ainda</p>
          <p className="text-sm">Inicie uma nova auditoria selecionando uma unidade acima</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Auditorias
        </CardTitle>
        <CardDescription>
          {audits.length} auditoria(s) registrada(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {audits.slice(0, 10).map((audit) => {
          const status = STATUS_CONFIG[audit.status as keyof typeof STATUS_CONFIG];
          const StatusIcon = status.icon;

          return (
            <Card
              key={audit.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/governanca-ec/auditoria/estoque/${audit.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{audit.unit?.name || "Unidade"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(audit.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={status.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    {audit.status !== "completed" && audit.status !== "reviewed" && (
                      <Button variant="ghost" size="icon">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {audit.total_items_loaded > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {audit.sample_size || 0}/{audit.total_items_loaded} itens na amostra
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
