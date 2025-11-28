import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, Package, MapPin, BarChart3 } from "lucide-react";
import { InventoryDashboard } from "@/components/trade/InventoryDashboard";

export default function Trade() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Trade Marketing</h1>
          <p className="text-muted-foreground mt-1">
            Auditorias, execução em campo e análise de PDV
          </p>
        </div>

        <Tabs defaultValue="inventory" className="animate-fade-in-up">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="audits" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Auditorias</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Inventário</span>
            </TabsTrigger>
            <TabsTrigger value="pdv" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">PDV</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audits" className="mt-6">
            <Card className="p-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Módulo de Auditorias em desenvolvimento</p>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <InventoryDashboard />
          </TabsContent>

          <TabsContent value="pdv" className="mt-6">
            <Card className="p-12 text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Módulo de PDV em desenvolvimento</p>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <Card className="p-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Relatórios de Trade em desenvolvimento</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
