import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2 } from "lucide-react";
import { GoalsDashboard } from "@/components/goals/GoalsDashboard";
import { GoalsList } from "@/components/goals/GoalsList";
import { GoalTypesList } from "@/components/goals/GoalTypesList";
import { CsvImporter } from "@/components/goals/CsvImporter";
import { SyncStatus } from "@/components/goals/SyncStatus";
import { SalesDashboard } from "@/components/sales/SalesDashboard";

export default function Goals() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Portal de Metas</h1>
          <p className="text-muted-foreground mt-1">
            {selectedCompany 
              ? `Gerencie as metas de ${selectedCompany.name}`
              : "Selecione uma empresa para gerenciar suas metas"
            }
          </p>
        </div>

        {!selectedCompanyId && (
          <Alert>
            <Building2 className="h-4 w-4" />
            <AlertDescription>
              Selecione uma empresa no menu lateral para visualizar e gerenciar as metas.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
            <TabsTrigger value="tipos">Tipos</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="importar">Importar</TabsTrigger>
            <TabsTrigger value="sync">Sincronização</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <GoalsDashboard />
          </TabsContent>

          <TabsContent value="metas" className="space-y-6">
            <GoalsList />
          </TabsContent>

          <TabsContent value="tipos" className="space-y-6">
            <GoalTypesList />
          </TabsContent>

          <TabsContent value="vendas" className="space-y-6">
            <SalesDashboard />
          </TabsContent>

          <TabsContent value="importar" className="space-y-6">
            <CsvImporter />
          </TabsContent>

          <TabsContent value="sync" className="space-y-6">
            <SyncStatus />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}