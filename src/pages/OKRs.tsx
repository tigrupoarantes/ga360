import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/CompanyContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { OKRDashboard } from "@/components/okrs/OKRDashboard";
import { ObjectivesList } from "@/components/okrs/ObjectivesList";

export default function OKRs() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { selectedCompany } = useCompany();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OKRs</h1>
          <p className="text-muted-foreground">
            Objectives and Key Results {selectedCompany ? `- ${selectedCompany.name}` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">SMART</span> — Específicas · Mensuráveis · Atingíveis · Relevantes · Temporais
          </p>
        </div>

        {!selectedCompany && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Selecione uma empresa no menu superior para visualizar os OKRs.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-background/50 backdrop-blur-sm border">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="objectives">Objetivos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <OKRDashboard />
          </TabsContent>

          <TabsContent value="objectives">
            <ObjectivesList />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
