import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatalakeConnectionsList } from "@/components/governanca-ec/admin/DatalakeConnectionsList";
import { DatalakeQueriesList } from "@/components/governanca-ec/admin/DatalakeQueriesList";
import { DatalakeBindingsList } from "@/components/governanca-ec/admin/DatalakeBindingsList";
import { DatalakeLogsViewer } from "@/components/governanca-ec/admin/DatalakeLogsViewer";
import { ECCardsList } from "@/components/governanca-ec/admin/ECCardsList";
import { Database, Link2, FileText, History, LayoutGrid } from "lucide-react";

export default function AdminGovernancaEC() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/admin" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Governança EC - Configurações</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie cards, conexões com Datalake e vínculos
            </p>
          </div>
        </div>

        <Tabs defaultValue="cards" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="cards" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Conexões
            </TabsTrigger>
            <TabsTrigger value="queries" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Queries
            </TabsTrigger>
            <TabsTrigger value="bindings" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Vínculos
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            <ECCardsList />
          </TabsContent>

          <TabsContent value="connections">
            <DatalakeConnectionsList />
          </TabsContent>

          <TabsContent value="queries">
            <DatalakeQueriesList />
          </TabsContent>

          <TabsContent value="bindings">
            <DatalakeBindingsList />
          </TabsContent>

          <TabsContent value="logs">
            <DatalakeLogsViewer />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
