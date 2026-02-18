import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { StockAuditWizard } from "@/components/stock-audit/StockAuditWizard";
import { AuditHistory } from "@/components/stock-audit/AuditHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, History, ShieldAlert } from "lucide-react";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function StockAuditStart() {
  const navigate = useNavigate();
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();

  // Find the Stock Audit card to check permissions
  const { data: stockAuditCard, isLoading: cardLoading } = useQuery({
    queryKey: ['ec-stock-audit-card'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_cards')
        .select('id, title')
        .or('title.ilike.%auditoria de estoque%,title.ilike.%stock audit%')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (permissionsLoading || cardLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  // Check card-level permission if we found the Stock Audit card
  if (stockAuditCard && !hasCardPermission(stockAuditCard.id, 'view')) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Você não tem permissão para acessar a Auditoria de Estoque</p>
          <Button variant="outline" onClick={() => navigate('/governanca-ec')}>
            Voltar para Governança
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/governanca-ec" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Auditoria de Estoque</h1>
            <p className="text-muted-foreground mt-1">
              Selecione uma unidade para iniciar ou continuar uma auditoria
            </p>
          </div>
        </div>

        <Tabs defaultValue="new" className="space-y-6">
          <TabsList>
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Auditoria
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            <StockAuditWizard />
          </TabsContent>

          <TabsContent value="history">
            <AuditHistory />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
