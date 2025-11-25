import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Processes() {
  return (
    <MainLayout userRole="Gerente">
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Processos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie processos recorrentes e checklists
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Processo
          </Button>
        </div>

        <Card className="p-12 text-center animate-fade-in-up">
          <p className="text-muted-foreground">Módulo de Processos em desenvolvimento</p>
        </Card>
      </div>
    </MainLayout>
  );
}
