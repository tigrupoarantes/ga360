import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Reports() {
  return (
    <MainLayout userRole="Gerente">
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground mt-1">
              Exporte e analise dados consolidados
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Relatório
          </Button>
        </div>

        <Card className="p-12 text-center animate-fade-in-up">
          <p className="text-muted-foreground">Módulo de Relatórios em desenvolvimento</p>
        </Card>
      </div>
    </MainLayout>
  );
}
