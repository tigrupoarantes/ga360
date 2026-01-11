import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2 } from "lucide-react";
import { ProcessDashboard } from "@/components/processes/ProcessDashboard";
import { ProcessList } from "@/components/processes/ProcessList";
import { ProcessExecutionHistory } from "@/components/processes/ProcessExecutionHistory";

export default function Processes() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Processos</h1>
          <p className="text-muted-foreground mt-1">
            {selectedCompany 
              ? `Gerencie os processos recorrentes de ${selectedCompany.name}`
              : "Selecione uma empresa para gerenciar seus processos"
            }
          </p>
        </div>

        {!selectedCompanyId && (
          <Alert>
            <Building2 className="h-4 w-4" />
            <AlertDescription>
              Selecione uma empresa no menu lateral para visualizar e gerenciar os processos.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="processos">Processos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <ProcessDashboard />
          </TabsContent>

          <TabsContent value="processos" className="space-y-6">
            <ProcessList />
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <ProcessExecutionHistory />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
