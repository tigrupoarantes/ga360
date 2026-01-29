import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { StockAuditWizard } from "@/components/stock-audit/StockAuditWizard";
import { AuditHistory } from "@/components/stock-audit/AuditHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, History } from "lucide-react";

export default function StockAuditStart() {
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
