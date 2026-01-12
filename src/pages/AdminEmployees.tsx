import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { ExternalEmployeesList } from "@/components/employees/ExternalEmployeesList";
import { EmployeeSyncDocs } from "@/components/employees/EmployeeSyncDocs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings } from "lucide-react";

export default function AdminEmployees() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 animate-fade-in">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Funcionários Externos</h1>
            <p className="text-muted-foreground mt-1">
              Funcionários sincronizados do sistema Gestão de Ativos
            </p>
          </div>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <Users className="h-4 w-4" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <ExternalEmployeesList />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <EmployeeSyncDocs />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
