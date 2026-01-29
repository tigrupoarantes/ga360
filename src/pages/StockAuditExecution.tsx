import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { StockAuditWizard } from "@/components/stock-audit/StockAuditWizard";
import { useStockAudit } from "@/hooks/useStockAudit";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Building2, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function StockAuditExecution() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const { audit, stats, isLoading } = useStockAudit(auditId);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  // If audit is completed, show summary
  if (audit?.status === "completed" || audit?.status === "reviewed") {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <BackButton to="/governanca-ec/auditoria/estoque" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Auditoria Concluída</h1>
              <p className="text-muted-foreground mt-1">
                Resumo da auditoria realizada
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{audit.unit?.name}</h2>
                    <p className="text-muted-foreground">
                      Concluída em {audit.completed_at && format(new Date(audit.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500">Concluída</Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total contado</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <p className="text-3xl font-bold text-green-600">{stats.ok}</p>
                  <p className="text-sm text-muted-foreground">OK</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                  <p className="text-3xl font-bold text-yellow-600">{stats.divergent}</p>
                  <p className="text-sm text-muted-foreground">Divergentes</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-3xl font-bold text-blue-600">{stats.recounted}</p>
                  <p className="text-sm text-muted-foreground">Recontados</p>
                </div>
              </div>

              {/* Witness info */}
              {audit.witness_name && (
                <div className="p-4 rounded-lg border space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Testemunha
                  </div>
                  <p className="font-medium">{audit.witness_name}</p>
                  <p className="text-sm text-muted-foreground">
                    CPF: {audit.witness_cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                  </p>
                </div>
              )}

              {audit.movement_during_audit && (
                <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Houve movimentação durante a auditoria
                  </p>
                  {audit.movement_notes && (
                    <p className="text-sm mt-1 text-muted-foreground">{audit.movement_notes}</p>
                  )}
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/governanca-ec/auditoria/estoque")}
              >
                Voltar para Auditorias
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/governanca-ec/auditoria/estoque" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {audit?.unit?.name || "Auditoria em andamento"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Continue de onde parou
            </p>
          </div>
        </div>

        <StockAuditWizard auditId={auditId} />
      </div>
    </MainLayout>
  );
}
