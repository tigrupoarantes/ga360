import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Database, FileSearch, Link2, History, Server } from "lucide-react";
import { DatalakeConnectionsList } from "@/components/governanca-ec/admin/DatalakeConnectionsList";
import { DatalakeQueriesList } from "@/components/governanca-ec/admin/DatalakeQueriesList";
import { DatalakeBindingsList } from "@/components/governanca-ec/admin/DatalakeBindingsList";
import { DatalakeLogsViewer } from "@/components/governanca-ec/admin/DatalakeLogsViewer";

export default function AdminDatalake() {
  const [activeTab, setActiveTab] = useState("connections");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 animate-fade-in">
          <BackButton to="/admin" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Integração Datalake</h1>
            <p className="text-muted-foreground mt-1">
              Configure conexões com SQL Server e queries de sincronização
            </p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Server className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Arquitetura de Integração</p>
              <p className="text-muted-foreground mt-1">
                O GA360 conecta ao seu SQL Server 2016 através de um <strong>API Proxy</strong> que você configura 
                no seu ambiente. As queries são executadas via endpoints REST seguros, trazendo dados de vendas, 
                metas e indicadores de governança.
              </p>
            </div>
          </div>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="connections" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Conexões</span>
            </TabsTrigger>
            <TabsTrigger value="queries" className="gap-2">
              <FileSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Queries</span>
            </TabsTrigger>
            <TabsTrigger value="bindings" className="gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Vínculos</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Conexões com Datalake</h2>
                <p className="text-sm text-muted-foreground">
                  Configure as conexões com seus servidores de API Proxy que expõem dados do SQL Server.
                </p>
              </div>
              <DatalakeConnectionsList />
            </Card>
          </TabsContent>

          <TabsContent value="queries" className="space-y-4">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Queries de Consulta</h2>
                <p className="text-sm text-muted-foreground">
                  Defina as queries (endpoints) que serão executadas para trazer dados do seu datalake.
                </p>
              </div>
              <DatalakeQueriesList />
            </Card>
          </TabsContent>

          <TabsContent value="bindings" className="space-y-4">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Vínculos de Dados</h2>
                <p className="text-sm text-muted-foreground">
                  Mapeie queries para atualizar automaticamente Metas ou Cards de Governança.
                </p>
              </div>
              <DatalakeBindingsList />
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Histórico de Execuções</h2>
                <p className="text-sm text-muted-foreground">
                  Acompanhe o histórico de execuções das queries e identifique possíveis erros.
                </p>
              </div>
              <DatalakeLogsViewer />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
